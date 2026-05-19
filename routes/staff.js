const express = require('express');
const router = express.Router();
const {
  getStaff,
  getStaffMember,
  createStaff,
  updateStaff,
  deleteStaff,
  markAttendance,
  recordSalary,
  getTodayAttendance,
  getMonthlySalarySummary,
} = require('../controllers/staffController');
const { protect, authorize } = require('../middleware/auth');

// Special routes before /:id
router.get('/attendance/today',   protect, authorize('admin', 'manager'), getTodayAttendance);
router.get('/salary/monthly',     protect, authorize('admin', 'manager'), getMonthlySalarySummary);

router.route('/')
  .get(protect, authorize('admin', 'manager'), getStaff)
  .post(protect, authorize('admin', 'manager'), createStaff);

router.route('/:id')
  .get(protect, authorize('admin', 'manager'), getStaffMember)
  .put(protect, authorize('admin', 'manager'), updateStaff)
  .delete(protect, authorize('admin'), deleteStaff);

router.put('/:id/attendance', protect, authorize('admin', 'manager'), markAttendance);
router.put('/:id/salary',     protect, authorize('admin', 'manager'),             recordSalary);

module.exports = router;
