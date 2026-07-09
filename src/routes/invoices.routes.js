const express = require('express');
const { pool, query } = require('../config/db');
const { protect, allowRoles } = require('../middleware/auth');
const { calculateLineItem, round2, amountToWordsIndian } = require('../utils/gst');

const router = express.Router();

function getFinancialYear(invoiceDate = new Date()) {
  const d = new Date(invoiceDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

async function generateInvoiceNo(conn, business, invoiceDate) {
  const financialYear = getFinancialYear(invoiceDate);
  const prefix = business.invoice_prefix || 'GST';

  const [seqRows] = await conn.execute(
    'SELECT * FROM invoice_sequences WHERE financial_year = ? FOR UPDATE',
    [financialYear]
  );

  let nextNo = 1;
  if (!seqRows.length) {
    await conn.execute('INSERT INTO invoice_sequences (financial_year, next_no) VALUES (?, 2)', [financialYear]);
  } else {
    nextNo = seqRows[0].next_no;
    await conn.execute('UPDATE invoice_sequences SET next_no = ? WHERE financial_year = ?', [nextNo + 1, financialYear]);
  }

  return `${prefix}-${financialYear}-${String(nextNo).padStart(4, '0')}`;
}

router.get('/', protect, async (req, res, next) => {
  try {
    const { from, to, search = '' } = req.query;
    const params = [];
    let where = 'WHERE 1=1';

    if (from) {
      where += ' AND i.invoice_date >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND i.invoice_date <= ?';
      params.push(to);
    }
    if (search) {
      where += ' AND (i.invoice_no LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(i.customer_snapshot, "$.name")) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(i.customer_snapshot, "$.phone")) LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const rows = await query(
      `SELECT i.id, i.invoice_no, i.invoice_date, i.tax_type, i.taxable_amount, i.total_tax, i.grand_total, i.paid_amount, i.balance_amount,
              i.payment_method, i.payment_status, i.status, i.cancel_reason, i.cancelled_at,
              JSON_UNQUOTE(JSON_EXTRACT(i.customer_snapshot, '$.name')) AS customer_name,
              JSON_UNQUOTE(JSON_EXTRACT(i.customer_snapshot, '$.phone')) AS customer_phone,
              (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) AS item_count
       FROM invoices i
       ${where}
       ORDER BY i.id DESC
       LIMIT 5000`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const invoices = await query('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!invoices.length) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const items = await query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [req.params.id]);
    res.json({ success: true, data: { ...invoices[0], items } });
  } catch (error) {
    next(error);
  }
});

router.post('/', protect, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const {
      invoice_date,
      customer_id,
      customer,
      items,
      payment_method = 'Cash',
      payment_status = 'Paid',
      paid_amount = 0,
      challan_no,
      eway_bill_no,
      transport_name,
      transport_gstin,
      notes = '',
      round_to_nearest_rupee = true
    } = req.body;

    if (!invoice_date) return res.status(400).json({ success: false, message: 'invoice_date is required' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ success: false, message: 'At least one item is required' });

    await conn.beginTransaction();

    const [businessRows] = await conn.execute('SELECT * FROM business_settings WHERE id = 1');
    if (!businessRows.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Business settings not configured' });
    }
    const business = businessRows[0];

    let customerSnapshot = customer || null;
    let finalCustomerId = customer_id || null;

    if (customer_id) {
      const [customerRows] = await conn.execute('SELECT * FROM customers WHERE id = ?', [customer_id]);
      if (!customerRows.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      customerSnapshot = customerRows[0];
    } else if (customer && customer.name) {
      const [newCustomer] = await conn.execute(
        `INSERT INTO customers (name, phone, email, address, gstin, state_name, state_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [customer.name, customer.phone || null, customer.email || null, customer.address || null, customer.gstin || null, customer.state_name || null, customer.state_code || null]
      );
      finalCustomerId = newCustomer.insertId;
      const [customerRows] = await conn.execute('SELECT * FROM customers WHERE id = ?', [finalCustomerId]);
      customerSnapshot = customerRows[0];
    } else {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'customer_id or customer object is required' });
    }

    const sameState = String(business.state_code || '').trim() && String(business.state_code || '').trim() === String(customerSnapshot.state_code || '').trim();
    const taxType = sameState ? 'CGST_SGST' : 'IGST';

    const invoiceNo = await generateInvoiceNo(conn, business, invoice_date);

    const finalItems = [];
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    for (const item of items) {
      const qty = Number(item.qty || 0);
      if (qty <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Item quantity must be greater than 0' });
      }

      let productSnapshot = null;
      if (item.product_id) {
        const [productRows] = await conn.execute('SELECT * FROM products WHERE id = ? AND is_active = TRUE FOR UPDATE', [item.product_id]);
        if (!productRows.length) {
          await conn.rollback();
          return res.status(404).json({ success: false, message: `Product not found: ${item.product_id}` });
        }
        productSnapshot = productRows[0];

        if (Number(productSnapshot.current_stock) < qty) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${productSnapshot.name}. Available: ${productSnapshot.current_stock}`
          });
        }
      }

      const productName = item.product_name || productSnapshot?.name;
      const rate = Number(item.rate ?? productSnapshot?.selling_price ?? 0);
      const gstRate = Number(item.gst_rate ?? productSnapshot?.gst_rate ?? 0);
      const unit = item.unit || productSnapshot?.unit || 'NOS';
      const hsnSac = item.hsn_sac || productSnapshot?.hsn_sac || null;

      if (!productName || rate < 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Each item needs product_name/rate or valid product_id' });
      }

      const calc = calculateLineItem({ qty, rate, discount: item.discount || 0, gst_rate: gstRate, taxType });

      taxableAmount += calc.taxable_value;
      cgstAmount += calc.cgst;
      sgstAmount += calc.sgst;
      igstAmount += calc.igst;

      finalItems.push({
        product_id: item.product_id || null,
        product_name: productName,
        hsn_sac: hsnSac,
        unit,
        qty,
        rate,
        discount: Number(item.discount || 0),
        gst_rate: gstRate,
        ...calc
      });
    }

    taxableAmount = round2(taxableAmount);
    cgstAmount = round2(cgstAmount);
    sgstAmount = round2(sgstAmount);
    igstAmount = round2(igstAmount);
    const totalTax = round2(cgstAmount + sgstAmount + igstAmount);
    const rawGrandTotal = round2(taxableAmount + totalTax);
    const grandTotal = round_to_nearest_rupee ? Math.round(rawGrandTotal) : rawGrandTotal;
    const roundOff = round2(grandTotal - rawGrandTotal);
    const safePaidAmount = Math.min(
  Math.max(round2(Number(paid_amount || 0)), 0),
  grandTotal
);

const balanceAmount = round2(grandTotal - safePaidAmount);

const finalPaymentStatus =
  balanceAmount <= 0 ? 'Paid' : safePaidAmount > 0 ? 'Partial' : 'Unpaid';

    

    const [invoiceResult] = await conn.execute(
  `INSERT INTO invoices
   (invoice_no, invoice_date, customer_id, customer_snapshot, business_snapshot, tax_type,
    taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, round_off, grand_total,
    paid_amount, balance_amount, amount_in_words, payment_method, payment_status, challan_no, eway_bill_no, transport_name,
    transport_gstin, notes, created_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    invoiceNo, invoice_date, finalCustomerId, JSON.stringify(customerSnapshot), JSON.stringify(business), taxType,
    taxableAmount, cgstAmount, sgstAmount, igstAmount, totalTax, roundOff, grandTotal,
    safePaidAmount, balanceAmount,
    amountToWordsIndian(grandTotal), payment_method, finalPaymentStatus, challan_no || null, eway_bill_no || null,
    transport_name || null, transport_gstin || null, notes, req.user.id
  ]
);

    const invoiceId = invoiceResult.insertId;

    for (const item of finalItems) {
      await conn.execute(
        `INSERT INTO invoice_items
         (invoice_id, product_id, product_name, hsn_sac, unit, qty, rate, discount, taxable_value, gst_rate, cgst, sgst, igst, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId, item.product_id, item.product_name, item.hsn_sac, item.unit, item.qty, item.rate,
          item.discount, item.taxable_value, item.gst_rate, item.cgst, item.sgst, item.igst, item.total
        ]
      );

      if (item.product_id) {
        const [products] = await conn.execute('SELECT current_stock FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
        const beforeStock = Number(products[0].current_stock || 0);
        const afterStock = beforeStock - Number(item.qty);
        await conn.execute('UPDATE products SET current_stock = ? WHERE id = ?', [afterStock, item.product_id]);
        await conn.execute(
          `INSERT INTO stock_transactions
           (product_id, type, qty_out, before_stock, after_stock, reference_type, reference_id, note)
           VALUES (?, 'SALE', ?, ?, ?, 'INVOICE', ?, ?)`,
          [item.product_id, item.qty, beforeStock, afterStock, invoiceId, `Invoice ${invoiceNo}`]
        );
      }
    }

    await conn.commit();

    const [invoiceRows] = await conn.execute('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    const [itemRows] = await conn.execute('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
    res.status(201).json({ success: true, data: { ...invoiceRows[0], items: itemRows } });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});


router.post('/:id/cancel', protect, allowRoles('admin'), async (req, res, next) => {
  const conn = await pool.getConnection();

  try {
    const invoiceId = req.params.id;
    const reason = req.body.reason || 'Cancelled by admin';

    await conn.beginTransaction();

    const [invoiceRows] = await conn.execute(
      'SELECT * FROM invoices WHERE id = ? FOR UPDATE',
      [invoiceId]
    );

    if (!invoiceRows.length) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = invoiceRows[0];

    if (invoice.status === 'CANCELLED') {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invoice already cancelled'
      });
    }

    const [items] = await conn.execute(
      'SELECT * FROM invoice_items WHERE invoice_id = ?',
      [invoiceId]
    );

    for (const item of items) {
      if (!item.product_id) continue;

      const [productRows] = await conn.execute(
        'SELECT * FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );

      if (!productRows.length) continue;

      const product = productRows[0];
      const beforeStock = Number(product.current_stock || 0);
      const restoreQty = Number(item.qty || 0);
      const afterStock = beforeStock + restoreQty;

      await conn.execute(
        'UPDATE products SET current_stock = ? WHERE id = ?',
        [afterStock, item.product_id]
      );

      await conn.execute(
        `INSERT INTO stock_transactions
         (product_id, type, qty_in, before_stock, after_stock, reference_type, reference_id, note)
         VALUES (?, 'ADJUSTMENT', ?, ?, ?, 'CANCELLED_INVOICE', ?, ?)`,
        [
          item.product_id,
          restoreQty,
          beforeStock,
          afterStock,
          invoiceId,
          `Stock restored for cancelled invoice ${invoice.invoice_no}`
        ]
      );
    }

    await conn.execute(
      `UPDATE invoices
       SET status = 'CANCELLED',
           cancelled_at = NOW(),
           cancel_reason = ?,
           cancelled_by = ?
       WHERE id = ?`,
      [reason, req.user.id, invoiceId]
    );

    await conn.commit();

    const [updatedRows] = await conn.execute(
      'SELECT * FROM invoices WHERE id = ?',
      [invoiceId]
    );

    res.json({
      success: true,
      message: 'Invoice cancelled and stock restored successfully',
      data: updatedRows[0]
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});


router.delete('/clear/all', protect, allowRoles('admin'), async (req, res, next) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Restore stock for active invoices before deleting history
    const [itemsToRestore] = await conn.execute(
      `SELECT ii.product_id, SUM(ii.qty) AS restore_qty
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE ii.product_id IS NOT NULL
         AND (i.status IS NULL OR i.status != 'CANCELLED')
       GROUP BY ii.product_id`
    );

    for (const item of itemsToRestore) {
      const productId = item.product_id;
      const restoreQty = Number(item.restore_qty || 0);

      const [productRows] = await conn.execute(
        'SELECT current_stock FROM products WHERE id = ? FOR UPDATE',
        [productId]
      );

      if (!productRows.length) continue;

      const beforeStock = Number(productRows[0].current_stock || 0);
      const afterStock = beforeStock + restoreQty;

      await conn.execute(
        'UPDATE products SET current_stock = ? WHERE id = ?',
        [afterStock, productId]
      );

      await conn.execute(
        `INSERT INTO stock_transactions
         (product_id, type, qty_in, before_stock, after_stock, reference_type, reference_id, note)
         VALUES (?, 'ADJUSTMENT', ?, ?, ?, 'CLEAR_HISTORY', NULL, ?)`,
        [
          productId,
          restoreQty,
          beforeStock,
          afterStock,
          'Stock restored while clearing invoice history'
        ]
      );
    }

    // invoice_items will delete automatically because of ON DELETE CASCADE
    await conn.execute('DELETE FROM invoices');

    await conn.commit();

    res.json({
      success: true,
      message: 'Invoice history cleared from backend and stock restored.'
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

module.exports = router;
