const express = require('express');
const { pool, query } = require('../config/db');
const { protect, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const includeInactive = req.query.includeInactive === 'true';
    const rows = await query(
      `SELECT * FROM products
       WHERE (? = TRUE OR is_active = TRUE)
       AND (name LIKE ? OR hsn_sac LIKE ? OR category LIKE ?)
       ORDER BY id DESC LIMIT 200`,
      [includeInactive, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/', protect, allowRoles('admin'), async (req, res, next) => {
  try {
    const {
      name, hsn_sac, category, unit = 'NOS', purchase_price = 0, selling_price = 0,
      gst_rate = 18, current_stock = 0, min_stock = 0
    } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Product name is required' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute(
        `INSERT INTO products
         (name, hsn_sac, category, unit, purchase_price, selling_price, gst_rate, current_stock, min_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, hsn_sac || null, category || null, unit, purchase_price, selling_price, gst_rate, current_stock, min_stock]
      );

      if (Number(current_stock) > 0) {
        await conn.execute(
          `INSERT INTO stock_transactions
           (product_id, type, qty_in, before_stock, after_stock, reference_type, reference_id, note)
           VALUES (?, 'OPENING', ?, 0, ?, 'PRODUCT', ?, 'Opening stock')`,
          [result.insertId, current_stock, current_stock, result.insertId]
        );
      }

      await conn.commit();
      const [rows] = await conn.execute('SELECT * FROM products WHERE id = ?', [result.insertId]);
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    next(error);
  }
});

router.put('/:id', protect, allowRoles('admin'), async (req, res, next) => {
  try {
    const {
      name, hsn_sac, category, unit = 'NOS', purchase_price = 0, selling_price = 0,
      gst_rate = 18, min_stock = 0, is_active = true
    } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Product name is required' });

    await query(
      `UPDATE products SET name=?, hsn_sac=?, category=?, unit=?, purchase_price=?, selling_price=?, gst_rate=?, min_stock=?, is_active=? WHERE id=?`,
      [name, hsn_sac || null, category || null, unit, purchase_price, selling_price, gst_rate, min_stock, is_active, req.params.id]
    );

    const rows = await query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/stock', protect, allowRoles('admin'), async (req, res, next) => {
  try {
    const { type = 'PURCHASE', qty = 0, note = '' } = req.body;
    const qtyNumber = Number(qty);

    if (!['PURCHASE', 'ADJUSTMENT'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Stock type must be PURCHASE or ADJUSTMENT' });
    }
    if (!qtyNumber) {
      return res.status(400).json({ success: false, message: 'Quantity is required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [products] = await conn.execute('SELECT * FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!products.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const beforeStock = Number(products[0].current_stock || 0);
      let afterStock = beforeStock;
      let qtyIn = 0;
      let qtyOut = 0;

      if (type === 'PURCHASE') {
        qtyIn = Math.abs(qtyNumber);
        afterStock = beforeStock + qtyIn;
      } else {
        afterStock = beforeStock + qtyNumber;
        if (qtyNumber > 0) qtyIn = qtyNumber;
        if (qtyNumber < 0) qtyOut = Math.abs(qtyNumber);
      }

      if (afterStock < 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Stock cannot be negative' });
      }

      await conn.execute('UPDATE products SET current_stock = ? WHERE id = ?', [afterStock, req.params.id]);
      await conn.execute(
        `INSERT INTO stock_transactions
         (product_id, type, qty_in, qty_out, before_stock, after_stock, reference_type, reference_id, note)
         VALUES (?, ?, ?, ?, ?, ?, 'MANUAL', NULL, ?)`,
        [req.params.id, type, qtyIn, qtyOut, beforeStock, afterStock, note]
      );

      await conn.commit();
      const [rows] = await conn.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', protect, allowRoles('admin'), async (req, res, next) => {
  try {
    await query('UPDATE products SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product disabled' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
