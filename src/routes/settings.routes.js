const express = require('express');
const { query } = require('../config/db');
const { protect, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM business_settings WHERE id = 1');
    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    next(error);
  }
});

router.put('/', protect, allowRoles('admin'), async (req, res, next) => {
  try {
    const fields = [
      'business_name',
      'business_tagline',
      'address',
      'phone',
      'email',
      'website',
      'gstin',
      'pan',
      'state_name',
      'state_code',
      'invoice_prefix',
      'financial_year',
      'bank_name',
      'bank_branch',
      'account_number',
      'ifsc',
      'upi_id',
      'qr_image',
      'terms'
    ];

    const data = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        data[field] = req.body[field];
      }
    }

    data.state_name = data.state_name || 'Tamil Nadu';
    data.state_code = data.state_code || (data.gstin && String(data.gstin).slice(0, 2)) || '33';

    if (!data.business_name) {
      return res.status(400).json({
        success: false,
        message: 'business_name is required'
      });
    }

    await query(
      `INSERT INTO business_settings
       (
        id, business_name, business_tagline, address, phone, email, website,
        gstin, pan, state_name, state_code, invoice_prefix, financial_year,
        bank_name, bank_branch, account_number, ifsc, upi_id, qr_image, terms
       )
       VALUES
       (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        qr_image = VALUES(qr_image),
        terms = VALUES(terms)`,
      [
        data.business_name,
        data.business_tagline || null,
        data.address || null,
        data.phone || null,
        data.email || null,
        data.website || null,
        data.gstin || null,
        data.pan || null,
        data.state_name || null,
        data.state_code || null,
        data.invoice_prefix || 'GST',
        data.financial_year || '2025-26',
        data.bank_name || null,
        data.bank_branch || null,
        data.account_number || null,
        data.ifsc || null,
        data.upi_id || null,
        data.qr_image || null,
        data.terms || null
      ]
    );

    const rows = await query('SELECT * FROM business_settings WHERE id = 1');

    res.json({
      success: true,
      message: 'Business settings saved successfully',
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;