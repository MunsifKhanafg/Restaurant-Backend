const asyncHandler = require('express-async-handler');
const Inventory = require('../models/Inventory');

// @desc  Get all inventory items
// @route GET /api/inventory
const getInventory = asyncHandler(async (req, res) => {
  const { category, stockStatus } = req.query;
  let query = {};
  if (category) query.category = category;

  let items = await Inventory.find(query).sort('name');

  // Filter by virtual stockStatus if requested
  if (stockStatus) {
    items = items.filter((item) => item.stockStatus === stockStatus);
  }

  res.json({ success: true, count: items.length, data: items });
});

// @desc  Get single inventory item
// @route GET /api/inventory/:id
const getInventoryItem = asyncHandler(async (req, res) => {
  const item = await Inventory.findById(req.params.id);
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }
  res.json({ success: true, data: item });
});

// @desc  Create inventory item
// @route POST /api/inventory
const createInventoryItem = asyncHandler(async (req, res) => {
  const item = await Inventory.create(req.body);
  res.status(201).json({ success: true, data: item });
});

// @desc  Update inventory item
// @route PUT /api/inventory/:id
const updateInventoryItem = asyncHandler(async (req, res) => {
  const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }
  res.json({ success: true, data: item });
});

// @desc  Delete inventory item
// @route DELETE /api/inventory/:id
const deleteInventoryItem = asyncHandler(async (req, res) => {
  const item = await Inventory.findByIdAndDelete(req.params.id);
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }
  res.json({ success: true, message: 'Inventory item deleted' });
});

// @desc  Restock an item (add quantity)
// @route PATCH /api/inventory/:id/restock
const restockItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity <= 0) { res.status(400); throw new Error('Quantity must be positive'); }

  const item = await Inventory.findByIdAndUpdate(
    req.params.id,
    {
      $inc: { currentQuantity: parseFloat(quantity) },
      lastRestocked: new Date(),
    },
    { new: true }
  );
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }
  res.json({ success: true, data: item });
});

// @desc  Deduct quantity from inventory (used when order completed)
// @route PATCH /api/inventory/:id/deduct
const deductInventory = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity <= 0) { res.status(400); throw new Error('Quantity must be positive'); }

  const item = await Inventory.findById(req.params.id);
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }

  item.currentQuantity = Math.max(0, item.currentQuantity - parseFloat(quantity));
  await item.save();

  res.json({ success: true, data: item });
});

// @desc  Get all low/out of stock items
// @route GET /api/inventory/alerts
const getInventoryAlerts = asyncHandler(async (req, res) => {
  const items = await Inventory.find({});
  const alerts = items.filter((i) => i.stockStatus !== 'available');
  res.json({ success: true, count: alerts.length, data: alerts });
});

module.exports = {
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  restockItem,
  deductInventory,
  getInventoryAlerts,
};
