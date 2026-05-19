const mongoose = require('mongoose');

// Singleton document — one doc per restaurant
const paymentConfigSchema = new mongoose.Schema({
  jazzcash: {
    number:      { type: String, default: '' },   // JazzCash mobile number
    accountName: { type: String, default: '' },   // Account holder name
  },
  easypaisa: {
    number:      { type: String, default: '' },
    accountName: { type: String, default: '' },
  },
  bankaccount: {
    accountTitle:  { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    bankName:      { type: String, default: '' },
    branchCode:    { type: String, default: '' },
    iban:          { type: String, default: '' },
  },
  whatsapp: { type: String, default: '' },  // Restaurant WhatsApp number for screenshot receipts
}, { timestamps: true });

module.exports = mongoose.model('PaymentConfig', paymentConfigSchema);
