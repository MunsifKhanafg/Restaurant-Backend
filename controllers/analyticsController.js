const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Expense = require('../models/Expense');
const Staff = require('../models/Staff');

// @desc  Get analytics overview
// @route GET /api/analytics/overview
const getOverview = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const [dailySales, monthlySales, yearlySales, dailyOrders, pendingOrders] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: monthStart }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: yearStart }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
    Order.countDocuments({ orderStatus: { $in: ['received', 'confirmed', 'preparing'] } }),
  ]);

  res.json({
    success: true,
    data: {
      daily: { sales: dailySales[0]?.total || 0, orders: dailySales[0]?.count || 0 },
      monthly: { sales: monthlySales[0]?.total || 0, orders: monthlySales[0]?.count || 0 },
      yearly: { sales: yearlySales[0]?.total || 0, orders: yearlySales[0]?.count || 0 },
      totalOrdersToday: dailyOrders,
      pendingOrders,
    },
  });
});

// @desc  Get profit calculation
// @route GET /api/analytics/profit
const getProfit = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year) || new Date().getFullYear();

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const [salesData, expenses, staffData] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, paymentStatus: 'paid' } },
      { $group: { _id: null, totalSales: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: start, $lt: end } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]),
    Staff.aggregate([
      { $group: { _id: null, totalSalary: { $sum: '$baseSalary' } } },
    ]),
  ]);

  const totalSales = salesData[0]?.totalSales || 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);
  const totalSalary = staffData[0]?.totalSalary || 0;
  const netProfit = totalSales - totalExpenses - totalSalary;

  res.json({
    success: true,
    data: {
      totalSales,
      totalExpenses,
      totalSalary,
      netProfit,
      profitMargin: totalSales ? ((netProfit / totalSales) * 100).toFixed(2) : 0,
      expenseBreakdown: expenses,
    },
  });
});

// @desc  Get chart data (daily sales for a month)
// @route GET /api/analytics/charts/daily
const getDailyChart = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year) || new Date().getFullYear();

  const data = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) },
        paymentStatus: 'paid',
      },
    },
    {
      $group: {
        _id: { $dayOfMonth: '$createdAt' },
        sales: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({ success: true, data });
});

module.exports = { getOverview, getProfit, getDailyChart };
