const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['Meat', 'Seafood', 'Vegetables', 'Dairy', 'Grains', 'Spices', 'Beverages', 'Packaging', 'Other'],
    required: true,
  },
  unit: {
    type: String,
    enum: ['kg', 'g', 'liter', 'ml', 'piece', 'dozen', 'box', 'bottle'],
    required: true,
  },
  currentQuantity: { type: Number, required: true, default: 0 },
  minimumQuantity: { type: Number, default: 5 },
  costPerUnit: { type: Number, default: 0 },
  supplier: { type: String, default: '' },
  lastRestocked: { type: Date },
  linkedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  usagePerOrder: { type: Number, default: 0.1 },
}, { timestamps: true });

inventorySchema.virtual('stockStatus').get(function () {
  if (this.currentQuantity <= 0) return 'finished';
  if (this.currentQuantity <= this.minimumQuantity) return 'low';
  return 'available';
});

inventorySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);
