const express = require('express');
const router  = express.Router();
const {
  createOrder, getOrders, getOrder, updateOrderStatus, getKitchenOrders,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

/*
  IMPORTANT — order matters in Express:
  Static paths (/kitchen) MUST be declared before param paths (/:id)
  otherwise Express matches "kitchen" as an :id value.
*/

// Kitchen display — only kitchen-facing roles
router.get(
  '/kitchen',
  protect,
  authorize('admin', 'manager', 'chef', 'waiter'),
  getKitchenOrders,
);

// List orders
router.get(
  '/',
  protect,
  authorize('admin', 'manager', 'waiter'),
  getOrders,
);

// GET orders — unauthenticated guests can list orders (for past-orders tab)
// MUST be declared BEFORE /:id to prevent Express matching 'guest-orders' as an :id value
router.get('/guest-orders', getOrders);

// Single order — public for guest order tracking (no auth needed)
router.get('/:id', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { req.user = null; return next(); }
  return protect(req, res, next);
}, getOrder);

// Create order — guests allowed WITHOUT a token; staff with a valid token get waiter attached
router.post('/', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  // No token at all → guest order, proceed without auth
  if (!token) { req.user = null; return next(); }
  // Has a token → validate it; on failure still allow (treat as guest)
  const jwt = require('jsonwebtoken');
  const User = require('../models/User');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    User.findById(decoded.id).select('-password').then(user => {
      req.user = user || null;
      next();
    }).catch(() => { req.user = null; next(); });
  } catch {
    req.user = null;
    next();
  }
}, createOrder);

// Update order status — staff or driver (protect but allow driver role)
router.put('/:id/status', protect, updateOrderStatus);

module.exports = router;
