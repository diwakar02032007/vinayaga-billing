const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

function shouldAutoSetup() {
  return ['true', '1', 'yes', 'on'].includes(String(process.env.AUTO_DB_SETUP || '').toLowerCase());
}

function cleanSchemaSql(schemaSql) {
  return schemaSql
    .replace(/CREATE DATABASE IF NOT EXISTS\s+[^;]+;/gi, '')
    .replace(/USE\s+[^;]+;/gi, '')
    .split(';')
    .map((stmt) => stmt.trim())
    .filter(Boolean);
}

function getSchemaPath() {
  const preferred = path.join(__dirname, '..', '..', 'database', 'schema-aiven-defaultdb.sql');
  const fallback = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  if (fs.existsSync(preferred)) return preferred;
  return fallback;
}

async function runSchema(conn) {
  const schemaPath = getSchemaPath();
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const statements = cleanSchemaSql(schemaSql);

  for (const statement of statements) {
    try {
      await conn.query(statement);
    } catch (error) {
      // MySQL does not support CREATE INDEX IF NOT EXISTS in older versions.
      // If auto setup runs again, duplicate index errors are safe to ignore.
      if (error && (error.code === 'ER_DUP_KEYNAME' || error.errno === 1061)) {
        continue;
      }
      throw error;
    }
  }
}

async function seedDefaultData(conn) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@billing.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Admin';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await conn.execute(
    `INSERT IGNORE INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, 'admin')`,
    [adminName, adminEmail, passwordHash]
  );

  await conn.execute(
    `INSERT INTO business_settings
     (id, business_name, business_tagline, address, phone, email, website, gstin, pan, state_name, state_code,
      invoice_prefix, financial_year, bank_name, bank_branch, account_number, ifsc, upi_id, terms)
     VALUES
     (1, 'Vinayaga Traders', 'Wholesale & Distribution of Quality Food Products', 'Hastampatti Salem - 636007',
      '9876543210', 'vinayagatraders@gmail.com', 'www.vinayagatraders.com', '33CORPP3939N1ZQ', 'CORPP3939N',
      'Tamil Nadu', '33', 'GST', '2026-27', 'ICICI', 'Salem', '2715500356', 'ICIC045F', 'diwakar@upi',
      'Subject to Salem Jurisdiction. Goods once sold will not taken back. Delivery Ex-Premises.')
     ON DUPLICATE KEY UPDATE id = id`,
    []
  );

  await conn.execute(
    `INSERT IGNORE INTO invoice_sequences (financial_year, next_no) VALUES ('2026-27', 1)`,
    []
  );

  const [productCountRows] = await conn.execute('SELECT COUNT(*) AS count FROM products');
  const productCount = Number(productCountRows[0]?.count || 0);
  if (productCount === 0) {
    const products = [
      ['Mixture', '210690', 'Snacks', 'NOS', 80, 100, 5, 100, 10],
      ['Lays', '210690', 'Snacks', 'NOS', 8, 10, 5, 100, 10],
      ['Biscuits', '190590', 'Food Items', 'NOS', 25, 30, 5, 100, 10]
    ];

    for (const product of products) {
      await conn.execute(
        `INSERT INTO products
         (name, hsn_sac, category, unit, purchase_price, selling_price, gst_rate, current_stock, min_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        product
      );
    }
  }
}

async function setupDatabaseIfNeeded() {
  if (!shouldAutoSetup()) return;

  const conn = await pool.getConnection();
  try {
    await runSchema(conn);
    await seedDefaultData(conn);
    console.log('Database auto setup completed.');
  } finally {
    conn.release();
  }
}

module.exports = { setupDatabaseIfNeeded };
