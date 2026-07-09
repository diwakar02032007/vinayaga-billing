const express = require('express');
const { query } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const rows = await query(
      `SELECT * FROM customers
       WHERE name LIKE ? OR phone LIKE ? OR gstin LIKE ?
       ORDER BY id DESC LIMIT 100`,
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const { name, phone, email, address, gstin, state_name, state_code } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Customer name is required' });

    const result = await query(
      `INSERT INTO customers (name, phone, email, address, gstin, state_name, state_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phone || null, email || null, address || null, gstin || null, state_name || null, state_code || null]
    );

    const rows = await query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', protect, async (req, res, next) => {
  try {
    const { name, phone, email, address, gstin, state_name, state_code } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Customer name is required' });

    await query(
      `UPDATE customers SET name=?, phone=?, email=?, address=?, gstin=?, state_name=?, state_code=? WHERE id=?`,
      [name, phone || null, email || null, address || null, gstin || null, state_name || null, state_code || null, req.params.id]
    );

    const rows = await query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    await query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
