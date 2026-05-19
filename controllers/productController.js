const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// @desc  Get all products
// @route GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const { category, available, search } = req.query;
  let query = {};
  if (category) query.category = category;
  if (available === 'true') query.isAvailable = true;
  if (search) query.name = { $regex: search, $options: 'i' };
  const products = await Product.find(query).sort('-createdAt');
  res.json({ success: true, count: products.length, data: products });
});

// @desc  Get single product
// @route GET /api/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  res.json({ success: true, data: product });
});

// @desc  Create product
// @route POST /api/products
const createProduct = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) {
    data.image = req.file.path || req.file.secure_url || `/uploads/${req.file.filename}`;
    data.imagePublicId = req.file.filename || req.file.public_id || '';
  }
  data.currentStock = data.initialStock || 100;
  const product = await Product.create(data);
  res.status(201).json({ success: true, data: product });
});

// @desc  Update product
// @route PUT /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) {
    data.image = req.file.path || `/uploads/${req.file.filename}`;
    data.imagePublicId = req.file.filename || req.file.public_id || '';
  }
  const product = await Product.findByIdAndUpdate(req.params.id, data, {
    new: true, runValidators: true,
  });
  if (!product) { res.status(404); throw new Error('Product not found'); }
  res.json({ success: true, data: product });
});

// @desc  Delete product
// @route DELETE /api/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  res.json({ success: true, message: 'Product deleted' });
});

// @desc  Get low/finished stock products
// @route GET /api/products/stock/alerts
const getStockAlerts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    $or: [
      { currentStock: { $lte: 0 } },
      { $expr: { $lte: ['$currentStock', '$lowStockThreshold'] } },
    ],
  });
  res.json({ success: true, count: products.length, data: products });
});

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getStockAlerts };
