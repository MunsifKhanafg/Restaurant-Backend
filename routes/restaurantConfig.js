const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const RestaurantConfig = require('../models/RestaurantConfig');
const { protect, authorize } = require('../middleware/auth');

// GET /api/restaurant-config  — public (guest page + sidebar need it)
router.get('/', asyncHandler(async (req, res) => {
  let config = await RestaurantConfig.findOne();
  if (!config) {
    config = await RestaurantConfig.create({
      name: process.env.RESTAURANT_NAME || 'My Restaurant',
      currency: process.env.CURRENCY || 'Rs.',
      taxPercent: parseFloat(process.env.TAX_PERCENTAGE) || 8,
    });
  }
  res.json({ success: true, data: config });
}));

// PUT /api/restaurant-config  — admin only
router.put('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { name, currency, taxPercent, logo, address, phone } = req.body;
  let config = await RestaurantConfig.findOne();
  if (!config) {
    config = await RestaurantConfig.create({ name, currency, taxPercent, logo, address, phone });
  } else {
    if (name      !== undefined) config.name       = name;
    if (currency  !== undefined) config.currency   = currency;
    if (taxPercent !== undefined) config.taxPercent = parseFloat(taxPercent);
    if (logo      !== undefined) config.logo       = logo;
    if (address   !== undefined) config.address    = address;
    if (phone     !== undefined) config.phone      = phone;
    await config.save();
  }
  res.json({ success: true, data: config });
}));

module.exports = router;
