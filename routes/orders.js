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

// Single order — any authenticated user (driver, chef, etc.)
router.get('/:id', protect, getOrder);

// Create order — any authenticated staff member
router.post('/', protect, createOrder);

// Update order status
router.put('/:id/status', protect, updateOrderStatus);

module.exports = router;
