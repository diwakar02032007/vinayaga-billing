const express = require('express');
const { query } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', protect, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const salesToday = await query(
      `SELECT COUNT(*) AS invoice_count, COALESCE(SUM(grand_total), 0) AS total_sales,
              COALESCE(SUM(total_tax), 0) AS total_tax
       FROM invoices WHERE invoice_date = ?`,
      [today]
    );

    const products = await query(
      `SELECT COUNT(*) AS product_count,
              SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END) AS low_stock_count
       FROM products WHERE is_active = TRUE`
    );

    const customers = await query('SELECT COUNT(*) AS customer_count FROM customers');

    res.json({
      success: true,
      data: {
        today,
        sales_today: salesToday[0],
        products: products[0],
        customers: customers[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sales', protect, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let where = 'WHERE 1=1';

    if (from) {
      where += ' AND invoice_date >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND invoice_date <= ?';
      params.push(to);
    }

    const summary = await query(
      `SELECT COUNT(*) AS invoice_count,
              COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
              COALESCE(SUM(cgst_amount), 0) AS cgst_amount,
              COALESCE(SUM(sgst_amount), 0) AS sgst_amount,
              COALESCE(SUM(igst_amount), 0) AS igst_amount,
              COALESCE(SUM(total_tax), 0) AS total_tax,
              COALESCE(SUM(grand_total), 0) AS grand_total
       FROM invoices ${where}`,
      params
    );

    const byDay = await query(
      `SELECT invoice_date, COUNT(*) AS invoice_count, COALESCE(SUM(grand_total), 0) AS total
       FROM invoices ${where}
       GROUP BY invoice_date
       ORDER BY invoice_date DESC`,
      params
    );

    res.json({ success: true, data: { summary: summary[0], by_day: byDay } });
  } catch (error) {
    next(error);
  }
});

router.get('/gst', protect, async (req, res, next) => {
  try {
    const { from, to } = req.query;
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

    const rows = await query(
      `SELECT ii.gst_rate,
              COALESCE(SUM(ii.taxable_value), 0) AS taxable_value,
              COALESCE(SUM(ii.cgst), 0) AS cgst,
              COALESCE(SUM(ii.sgst), 0) AS sgst,
              COALESCE(SUM(ii.igst), 0) AS igst,
              COALESCE(SUM(ii.total), 0) AS total
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       ${where}
       GROUP BY ii.gst_rate
       ORDER BY ii.gst_rate`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/low-stock', protect, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, hsn_sac, unit, current_stock, min_stock
       FROM products
       WHERE is_active = TRUE AND current_stock <= min_stock
       ORDER BY current_stock ASC, name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
