const express = require('express');
const router  = express.Router();
const {
  createOrder, addItemsToOrder, switchTable,
  getOrders, getOrder, updateOrderStatus, getKitchenOrders, clearMonthOrders,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

/*
  IMPORTANT — Express route ordering:
  Static / specific paths MUST come before dynamic param paths (/:id).
  All DELETE/PUT statics are declared before /:id wildcards.
*/

/* ─────────────────────────────────────────
   Reusable optional-auth middleware
   Attaches req.user if a valid token is present,
   but does NOT block the request if there is no token.
───────────────────────────────────────────*/
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { req.user = null; return next(); }
  const jwt  = require('jsonwebtoken');
  const User = require('../models/User');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    User.findById(decoded.id)
      .select('-password')
      .then(user => { req.user = user || null; next(); })
      .catch(()  => { req.user = null;         next(); });
  } catch {
    req.user = null;
    next();
  }
};

/* ════════════════════════════════════════
   GET routes  (static paths first)
════════════════════════════════════════ */

/* Kitchen display — staff only */
router.get('/kitchen', protect, authorize('admin', 'manager', 'chef', 'waiter'), getKitchenOrders);

/* Guest order list — no auth required */
router.get('/guest-orders', getOrders);

/* Occupied-tables status — public, no auth */
router.get('/tables/status', async (req, res) => {
  try {
    const Order = require('../models/Order');
    const activeOrders = await Order.find({
      orderType:   'dine-in',
      orderStatus: { $in: ['received', 'confirmed', 'preparing', 'ready'] },
      tableNumber: { $ne: null },
    }).select('tableNumber orderStatus createdAt billId');

    /* De-duplicate: keep newest order per table */
    const tableMap = {};
    activeOrders.forEach(o => {
      if (!tableMap[o.tableNumber] ||
          new Date(o.createdAt) > new Date(tableMap[o.tableNumber].createdAt)) {
        tableMap[o.tableNumber] = {
          tableNumber: o.tableNumber,
          orderStatus: o.orderStatus,
          billId:      o.billId,
          createdAt:   o.createdAt,
        };
      }
    });

    res.json({ success: true, data: Object.values(tableMap) });
  } catch (err) {
    res.status(500).json({ success: false, data: [] });
  }
});

/* Single-table active-order check — public, no auth */
router.get('/table/:tableNum/status', async (req, res) => {
  try {
    const Order    = require('../models/Order');
    const tableNum = parseInt(req.params.tableNum);
    if (isNaN(tableNum)) return res.json({ occupied: false, order: null });
    const activeOrder = await Order.findOne({
      tableNumber: tableNum,
      orderType:   'dine-in',
      orderStatus: { $in: ['received', 'confirmed', 'preparing', 'ready'] },
    })
      .select('_id orderStatus items createdAt customer billId')
      .populate('items.product', 'cookingTime name');
    res.json({ occupied: !!activeOrder, order: activeOrder || null });
  } catch (err) {
    res.status(500).json({ occupied: false, order: null });
  }
});

/* List orders — staff only */
router.get('/', protect, authorize('admin', 'manager', 'waiter'), getOrders);

/* Single order — guests and staff (optional auth) */
router.get('/:id', optionalAuth, getOrder);

/* ════════════════════════════════════════
   POST routes
════════════════════════════════════════ */

/* Create order — guests allowed (optional auth) */
router.post('/', optionalAuth, createOrder);

/* ════════════════════════════════════════
   PUT routes  (static sub-paths first, /:id last)
════════════════════════════════════════ */

/* Add items to existing active order — guests allowed */
router.put('/:id/add-items', optionalAuth, addItemsToOrder);

/* Switch table for a dine-in order — guests allowed */
router.put('/:id/switch-table', optionalAuth, switchTable);

/* Update order status — staff/driver only */
router.put('/:id/status', protect, updateOrderStatus);

/* ════════════════════════════════════════
   DELETE routes  (static paths before /:id)
════════════════════════════════════════ */

/* Clear orders for a month — admin/manager only */
router.delete('/clear-month', protect, authorize('admin', 'manager'), clearMonthOrders);

module.exports = router;
