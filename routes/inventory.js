const express = require('express');
const router = express.Router();
const {
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  restockItem,
  deductInventory,
  getInventoryAlerts,
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

// Alert route must be before /:id
router.get('/alerts', protect, authorize('admin', 'manager'), getInventoryAlerts);

router.route('/')
  .get(protect, getInventory)
  .post(protect, authorize('admin', 'manager'), createInventoryItem);

router.route('/:id')
  .get(protect, getInventoryItem)
  .put(protect, authorize('admin', 'manager'), updateInventoryItem)
  .delete(protect, authorize('admin'), deleteInventoryItem);

router.patch('/:id/restock', protect, authorize('admin', 'manager'), restockItem);
router.patch('/:id/deduct',  protect, authorize('admin', 'manager'), deductInventory);

module.exports = router;
