const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const PaymentConfig = require('../models/PaymentConfig');
const { protect, authorize } = require('../middleware/auth');

// GET /api/payment-config  — public (POS needs it without auth for order screen)
router.get('/', asyncHandler(async (req, res) => {
  let config = await PaymentConfig.findOne();
  if (!config) config = await PaymentConfig.create({});
  res.json({ success: true, data: config });
}));

// PUT /api/payment-config  — admin only
router.put('/', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  let config = await PaymentConfig.findOne();
  if (!config) {
    config = await PaymentConfig.create(req.body);
  } else {
    // Use $set via findOneAndUpdate so nested fields are properly persisted
    const update = {};
    // Use the value from req.body directly — allow empty strings so user can clear fields
    if (req.body.jazzcash) {
      update['jazzcash.number']      = req.body.jazzcash.number      !== undefined ? req.body.jazzcash.number      : config.jazzcash.number;
      update['jazzcash.accountName'] = req.body.jazzcash.accountName !== undefined ? req.body.jazzcash.accountName : config.jazzcash.accountName;
    }
    if (req.body.easypaisa) {
      update['easypaisa.number']      = req.body.easypaisa.number      !== undefined ? req.body.easypaisa.number      : config.easypaisa.number;
      update['easypaisa.accountName'] = req.body.easypaisa.accountName !== undefined ? req.body.easypaisa.accountName : config.easypaisa.accountName;
    }
    if (req.body.bankaccount) {
      const ba = req.body.bankaccount;
      update['bankaccount.accountTitle']  = ba.accountTitle  !== undefined ? ba.accountTitle  : config.bankaccount.accountTitle;
      update['bankaccount.accountNumber'] = ba.accountNumber !== undefined ? ba.accountNumber : config.bankaccount.accountNumber;
      update['bankaccount.bankName']      = ba.bankName      !== undefined ? ba.bankName      : config.bankaccount.bankName;
      update['bankaccount.branchCode']    = ba.branchCode    !== undefined ? ba.branchCode    : config.bankaccount.branchCode;
      update['bankaccount.iban']          = ba.iban          !== undefined ? ba.iban          : config.bankaccount.iban;
    }
    if (req.body.whatsapp !== undefined) update.whatsapp = req.body.whatsapp;

    config = await PaymentConfig.findOneAndUpdate(
      { _id: config._id },
      { $set: update },
      { new: true, runValidators: true }
    );
  }
  res.json({ success: true, data: config });
}));

module.exports = router;
