const mysql = require('mysql2/promise');
require('dotenv').config();

function readBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

const sslEnabled = readBool(process.env.DB_SSL, process.env.NODE_ENV === 'production');
const rejectUnauthorized = readBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);

const poolConfig = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'billing_system',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  decimalNumbers: true
};

if (sslEnabled) {
  poolConfig.ssl = { rejectUnauthorized };
}

const pool = mysql.createPool(poolConfig);

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { pool, query };
