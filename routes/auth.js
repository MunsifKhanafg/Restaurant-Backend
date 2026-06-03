const express = require('express');
const router  = express.Router();
const {
  register, login, getMe, getAllUsers,
  updateUser, updateRoleCredentials, deleteUser,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', login);
router.get('/me',    protect, getMe);

// ── role-based shared credentials (must come before /:id) ──
router.put('/users/role/:role', protect, authorize('admin'), updateRoleCredentials);

// ── individual user management ──
router.post('/register',    protect, authorize('admin'), register);
router.get('/users',        protect, authorize('admin', 'manager'), getAllUsers);
router.put('/users/:id',    protect, authorize('admin'), updateUser);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

module.exports = router;
