CREATE DATABASE IF NOT EXISTS billing_system;
USE billing_system;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'cashier') NOT NULL DEFAULT 'cashier',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_settings (
  id INT PRIMARY KEY DEFAULT 1,
  business_name VARCHAR(180) NOT NULL,
  business_tagline VARCHAR(255) NULL,
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(160),
  website VARCHAR(160),
  gstin VARCHAR(30),
  pan VARCHAR(30),
  state_name VARCHAR(80) NOT NULL DEFAULT 'Tamil Nadu',
  state_code VARCHAR(5) NOT NULL DEFAULT '33',
  invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'GST',
  financial_year VARCHAR(10) NOT NULL DEFAULT '2026-27',
  bank_name VARCHAR(120),
  bank_branch VARCHAR(120),
  account_number VARCHAR(50),
  ifsc VARCHAR(30),
  upi_id VARCHAR(100),
  qr_image LONGTEXT NULL,
  terms TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(160),
  address TEXT,
  gstin VARCHAR(30),
  state_name VARCHAR(80),
  state_code VARCHAR(5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(220) NOT NULL,
  hsn_sac VARCHAR(40),
  category VARCHAR(120),
  unit VARCHAR(30) NOT NULL DEFAULT 'NOS',
  purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  min_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  financial_year VARCHAR(10) NOT NULL UNIQUE,
  next_no INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(60) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  customer_id INT NULL,
  customer_snapshot JSON,
  business_snapshot JSON,
  tax_type ENUM('IGST', 'CGST_SGST') NOT NULL DEFAULT 'CGST_SGST',
  taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  cgst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  round_off DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_in_words VARCHAR(500),
  payment_method ENUM('Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit') NOT NULL DEFAULT 'Cash',
  payment_status ENUM('Paid', 'Unpaid', 'Partial') NOT NULL DEFAULT 'Paid',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  challan_no VARCHAR(80),
  eway_bill_no VARCHAR(80),
  transport_name VARCHAR(150),
  transport_gstin VARCHAR(30),
  notes TEXT,
  cancel_reason VARCHAR(255) NULL,
  cancelled_at DATETIME NULL,
  cancelled_by INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(220) NOT NULL,
  hsn_sac VARCHAR(40),
  unit VARCHAR(30) NOT NULL DEFAULT 'NOS',
  qty DECIMAL(12,2) NOT NULL,
  rate DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  taxable_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  cgst DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  type ENUM('OPENING', 'PURCHASE', 'SALE', 'ADJUSTMENT') NOT NULL,
  qty_in DECIMAL(12,2) NOT NULL DEFAULT 0,
  qty_out DECIMAL(12,2) NOT NULL DEFAULT 0,
  before_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  after_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  reference_type VARCHAR(50),
  reference_id INT,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_stock_product ON stock_transactions(product_id);
