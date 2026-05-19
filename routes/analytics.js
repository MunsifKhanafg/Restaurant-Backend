const express = require('express');
const router = express.Router();
const { getOverview, getProfit, getDailyChart } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('express-async-handler');
const Expense = require('../models/Expense');

router.get('/overview', protect, authorize('admin', 'manager'), getOverview);
router.get('/profit', protect, authorize('admin', 'manager'), getProfit);
router.get('/charts/daily', protect, authorize('admin', 'manager'), getDailyChart);

// Expenses
router.get('/expenses', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  let query = {};
  if (month && year) {
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 1);
    query.date = { $gte: start, $lt: end };
  }
  const expenses = await Expense.find(query).sort('-date').limit(100);
  res.json({ success: true, data: expenses });
}));

router.post('/expenses', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const expense = await Expense.create({ ...req.body, addedBy: req.user._id });
  res.status(201).json({ success: true, data: expense });
}));

router.delete('/expenses/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  await Expense.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
}));

module.exports = router;
