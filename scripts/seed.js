require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const passwordHash = await bcrypt.hash('admin123', 10);

    await conn.execute(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role)`,
      ['Admin', 'admin@billing.local', passwordHash, 'admin']
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
       ON DUPLICATE KEY UPDATE
        business_name = VALUES(business_name),
        business_tagline = VALUES(business_tagline),
        address = VALUES(address),
        phone = VALUES(phone),
        email = VALUES(email),
        website = VALUES(website),
        gstin = VALUES(gstin),
        pan = VALUES(pan),
        state_name = VALUES(state_name),
        state_code = VALUES(state_code),
        invoice_prefix = VALUES(invoice_prefix),
        financial_year = VALUES(financial_year),
        bank_name = VALUES(bank_name),
        bank_branch = VALUES(bank_branch),
        account_number = VALUES(account_number),
        ifsc = VALUES(ifsc),
        upi_id = VALUES(upi_id),
        terms = VALUES(terms)`,
      []
    );

    const products = [
      ['Mixture', '210690', 'Snacks', 'NOS', 80, 100, 5, 100, 10],
      ['Lays', '210690', 'Snacks', 'NOS', 8, 10, 5, 100, 10],
      ['Biscuits', '190590', 'Food Items', 'NOS', 25, 30, 5, 100, 10]
    ];

    for (const p of products) {
      await conn.execute(
        `INSERT INTO products
         (name, hsn_sac, category, unit, purchase_price, selling_price, gst_rate, current_stock, min_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p
      );
    }

    await conn.execute(
      `INSERT IGNORE INTO invoice_sequences (financial_year, next_no) VALUES ('2025-26', 1)`
    );

    await conn.commit();
    console.log('Seed completed. Login: admin@billing.local / admin123');
  } catch (error) {
    await conn.rollback();
    console.error(error);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();
