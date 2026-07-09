const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Login token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const users = await query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (!users.length || !users[0].is_active) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
  };
}

module.exports = { protect, allowRoles };
