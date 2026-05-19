const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0 },
  category: {
    type: String,
    required: true,
    enum: ['Starters', 'Main Course', 'Grill & BBQ', 'Seafood', 'Pasta & Rice',
           'Pizza', 'Burgers', 'Salads', 'Soups', 'Desserts', 'Beverages', 'Specials'],
  },
  image: { type: String, default: '' },
  imagePublicId: { type: String, default: '' },
  cookingTime: { type: Number, default: 15, comment: 'in minutes' },
  initialStock: { type: Number, default: 100 },
  currentStock: { type: Number, default: 100 },
  lowStockThreshold: { type: Number, default: 10 },
  isAvailable: { type: Boolean, default: true },
  isVegetarian: { type: Boolean, default: false },
  spiceLevel: { type: String, enum: ['mild', 'medium', 'hot', 'extra-hot'], default: 'mild' },
  tags: [{ type: String }],
  rating: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
}, { timestamps: true });

productSchema.virtual('stockStatus').get(function () {
  if (this.currentStock <= 0) return 'finished';
  if (this.currentStock <= this.lowStockThreshold) return 'low';
  return 'available';
});

productSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
