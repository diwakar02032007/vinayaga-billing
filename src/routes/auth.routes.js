const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { protect, allowRoles } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const users = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (!users.length) {
      return res.status(401).json({ success: false, message: 'Invalid login details' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid login details' });
    }

    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/users', protect, allowRoles('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role = 'cashier' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role]
    );

    res.status(201).json({ success: true, id: result.insertId, message: 'User created' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      error.status = 409;
      error.message = 'Email already exists';
    }
    next(error);
  }
});

router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
