USE billing_system;

ALTER TABLE business_settings ADD COLUMN business_tagline VARCHAR(255) NULL;
ALTER TABLE business_settings ADD COLUMN website VARCHAR(160) NULL;
ALTER TABLE business_settings ADD COLUMN qr_image LONGTEXT NULL;

ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER grand_total;
ALTER TABLE invoices ADD COLUMN balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER paid_amount;
ALTER TABLE invoices ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' AFTER payment_status;
ALTER TABLE invoices ADD COLUMN cancelled_at DATETIME NULL;
ALTER TABLE invoices ADD COLUMN cancel_reason VARCHAR(255) NULL;
ALTER TABLE invoices ADD COLUMN cancelled_by INT NULL;

UPDATE business_settings
SET state_name = 'Tamil Nadu',
    state_code = '33'
WHERE id = 1 AND (state_code IS NULL OR state_code = '' OR state_code != '33');
