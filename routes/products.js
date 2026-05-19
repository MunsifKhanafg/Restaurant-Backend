const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct, getStockAlerts,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

router.get('/stock/alerts', protect, authorize('admin', 'manager'), getStockAlerts);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', protect, authorize('admin', 'manager'), upload.single('image'), createProduct);
router.put('/:id', protect, authorize('admin', 'manager'), upload.single('image'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

module.exports = router;
