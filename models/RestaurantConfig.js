const mongoose = require('mongoose');

// Singleton document — one doc per restaurant
const restaurantConfigSchema = new mongoose.Schema({
  name:        { type: String, default: 'My Restaurant' },
  currency:    { type: String, default: 'Rs.' },
  taxPercent:  { type: Number, default: 8 },
  logo:        { type: String, default: '' },   // optional URL
  address:     { type: String, default: '' },
  phone:       { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('RestaurantConfig', restaurantConfigSchema);
