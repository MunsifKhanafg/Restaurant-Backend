const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  specialInstructions: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'served'],
    default: 'pending',
  },
});

/* ── helper: generate a unique bill ID with timestamp prefix ── */
const makeBillId = () => {
  const ts  = Date.now().toString(36).toUpperCase();           // base-36 timestamp (~7 chars)
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase(); // 4 random chars
  return `BILL-${ts}-${rnd}`;  // e.g. BILL-LM3K7A2-4FXQ  — collision probability ~1 in 1.6 billion
};

const orderSchema = new mongoose.Schema({
  billId: {
    type: String,
    unique: true,
    default: makeBillId,
  },
  orderType: {
    type: String,
    enum: ['dine-in', 'takeaway', 'delivery'],
    required: true,
  },
  tableNumber: { type: Number, default: null },
  waiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  customer: {
    name:         { type: String, default: '' },
    phone:        { type: String, default: '' },
    address:      { type: String, default: '' },
    deliveryZone: { type: String, default: '' },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },

  items: [orderItemSchema],

  subtotal:       { type: Number, required: true, min: 0 },
  taxPercentage:  { type: Number, default: 8 },
  taxAmount:      { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  breadIncluded:  { type: Boolean, default: false },
  breadCharge:    { type: Number, default: 0 },
  totalAmount:    { type: Number, required: true, min: 0 },

  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'cod', 'jazzcash', 'easypaisa', 'bankaccount'],
    default: 'cash',
  },

  /* Flat fields — no nested object — avoids Mongoose subdoc issues */
  payRefNumber:  { type: String, default: '' },   // transaction / reference ID
  paySenderName: { type: String, default: '' },   // sender name on JazzCash / Easypaisa

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  orderStatus: {
    type: String,
    enum: ['received', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'],
    default: 'received',
  },

  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  estimatedDeliveryTime: { type: Number, default: 30 },
  notes: { type: String, default: '' },
  completedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
