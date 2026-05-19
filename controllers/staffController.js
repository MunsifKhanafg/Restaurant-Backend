const asyncHandler = require('express-async-handler');
const Staff = require('../models/Staff');
const User = require('../models/User');

// @desc  Get all staff members
// @route GET /api/staff
const getStaff = asyncHandler(async (req, res) => {
  const { department, isActive } = req.query;
  let query = {};
  if (department) query.department = department;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const staff = await Staff.find(query)
    .populate('user', 'name email role phone avatar')
    .sort('-createdAt');

  res.json({ success: true, count: staff.length, data: staff });
});

// @desc  Get single staff member
// @route GET /api/staff/:id
const getStaffMember = asyncHandler(async (req, res) => {
  const member = await Staff.findById(req.params.id)
    .populate('user', 'name email role phone avatar');
  if (!member) { res.status(404); throw new Error('Staff member not found'); }
  res.json({ success: true, data: member });
});

// Helper — build a unique email from a name
function buildEmail(name) {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  return `${slug}.${Date.now().toString().slice(-5)}@staff.local`;
}

// Helper — random 8-char password
function generatePassword() {
  return Math.random().toString(36).slice(-8) + 'A1!';
}

// @desc  Create staff member — email & password are OPTIONAL (auto-generated if missing)
// @route POST /api/staff
const createStaff = asyncHandler(async (req, res) => {
  const {
    // ── User account fields ──
    name, email, password, role, phone,
    // ── Staff profile fields ──
    designation, department, baseSalary,
    joiningDate, emergencyContact, address,
    dutyStartTime, dutyEndTime,
    // ── Legacy: allow passing an existing userId directly ──
    user: existingUserId,
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Staff member name is required.');
  }

  let userId;

  if (existingUserId) {
    // ── Legacy path: link to an existing user account ──
    const user = await User.findById(existingUserId);
    if (!user) { res.status(404); throw new Error('User not found. Please check the User ID.'); }
    userId = existingUserId;
  } else {
    // ── Auto-generate email & password if not provided ──
    const resolvedEmail    = (email && email.trim()) ? email.trim().toLowerCase() : buildEmail(name);
    const resolvedPassword = (password && password.length >= 6) ? password : generatePassword();

    // Check if email already taken — if auto-generated it will always be unique,
    // but if user typed one we must validate
    const exists = await User.findOne({ email: resolvedEmail });
    if (exists) {
      res.status(400);
      throw new Error(`A user with email "${resolvedEmail}" already exists. Use a different email.`);
    }

    const newUser = await User.create({
      name:     name.trim(),
      email:    resolvedEmail,
      password: resolvedPassword,
      role:     role || 'waiter',
      phone:    phone || '',
    });
    userId = newUser._id;
  }

  // Check if a staff profile already exists for this user
  const existing = await Staff.findOne({ user: userId });
  if (existing) {
    res.status(400);
    throw new Error('A staff profile already exists for this user account.');
  }

  if (!designation || !department || !baseSalary) {
    res.status(400);
    throw new Error('Designation, department and base salary are required.');
  }

  const member = await Staff.create({
    user: userId,
    designation,
    department,
    baseSalary: parseFloat(baseSalary),
    joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
    emergencyContact: emergencyContact || '',
    address: address || '',
    dutyStartTime: dutyStartTime || '09:00',
    dutyEndTime: dutyEndTime || '18:00',
  });

  const populated = await Staff.findById(member._id).populate('user', 'name email role phone');
  res.status(201).json({ success: true, data: populated });
});

// @desc  Update staff member
// @route PUT /api/staff/:id
const updateStaff = asyncHandler(async (req, res) => {
  const member = await Staff.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('user', 'name email role phone');
  if (!member) { res.status(404); throw new Error('Staff member not found'); }
  res.json({ success: true, data: member });
});

// @desc  Delete staff member
// @route DELETE /api/staff/:id
const deleteStaff = asyncHandler(async (req, res) => {
  const member = await Staff.findByIdAndDelete(req.params.id);
  if (!member) { res.status(404); throw new Error('Staff member not found'); }
  res.json({ success: true, message: 'Staff member deleted' });
});

// @desc  Record attendance for a staff member
// @route PUT /api/staff/:id/attendance
const markAttendance = asyncHandler(async (req, res) => {
  const { date, status, checkIn, checkOut, notes } = req.body;
  const member = await Staff.findById(req.params.id);
  if (!member) { res.status(404); throw new Error('Staff member not found'); }

  const targetDate = new Date(date).toISOString().split('T')[0];
  const existingIdx = member.attendance.findIndex(
    (a) => new Date(a.date).toISOString().split('T')[0] === targetDate
  );

  if (existingIdx !== -1) {
    member.attendance[existingIdx] = { date: new Date(date), status, checkIn, checkOut, notes };
  } else {
    member.attendance.push({ date: new Date(date), status, checkIn, checkOut, notes });
  }

  await member.save();
  res.json({ success: true, data: member });
});

// Helper: count absent days for a staff member in a given month/year
function countAbsentDays(attendanceArr, month, year) {
  return attendanceArr.filter((a) => {
    const d = new Date(a.date);
    return d.getMonth() + 1 === parseInt(month) && d.getFullYear() === parseInt(year) && a.status === 'absent';
  }).length;
}

// @desc  Record salary for a staff member (auto-calculates absent deduction)
// @route PUT /api/staff/:id/salary
const recordSalary = asyncHandler(async (req, res) => {
  const { month, year, baseSalary, bonus, deductions, paid, workingDaysInMonth } = req.body;
  const member = await Staff.findById(req.params.id);
  if (!member) { res.status(404); throw new Error('Staff member not found'); }

  const absentDays = countAbsentDays(member.attendance, month, year);
  const totalWorkingDays = parseInt(workingDaysInMonth) || 26;
  const perDaySalary = parseFloat(baseSalary) / totalWorkingDays;
  const absentDeduction = parseFloat((perDaySalary * absentDays).toFixed(2));
  const totalDeductions = parseFloat(deductions || 0) + absentDeduction;
  const netSalary = parseFloat(baseSalary) + parseFloat(bonus || 0) - totalDeductions;

  const salaryEntry = {
    month: parseInt(month),
    year: parseInt(year),
    baseSalary: parseFloat(baseSalary),
    bonus: parseFloat(bonus) || 0,
    deductions: parseFloat(deductions) || 0,
    absentDays,
    absentDeduction,
    netSalary: parseFloat(netSalary.toFixed(2)),
    paid: paid || false,
    paidDate: paid ? new Date() : undefined,
  };

  const existingIdx = member.salaryHistory.findIndex(
    (s) => s.month === parseInt(month) && s.year === parseInt(year)
  );

  if (existingIdx !== -1) {
    member.salaryHistory[existingIdx] = salaryEntry;
  } else {
    member.salaryHistory.push(salaryEntry);
  }

  await member.save();
  res.json({ success: true, data: member, absentDays, absentDeduction });
});

// @desc  Get monthly salary summary for all staff
// @route GET /api/staff/salary/monthly
const getMonthlySalarySummary = asyncHandler(async (req, res) => {
  const { month, year, workingDaysInMonth } = req.query;
  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year) || new Date().getFullYear();
  const totalWorkingDays = parseInt(workingDaysInMonth) || 26;

  const staff = await Staff.find({ isActive: true }).populate('user', 'name email role');

  const summary = staff.map((member) => {
    const absentDays = countAbsentDays(member.attendance, m, y);
    const perDay = member.baseSalary / totalWorkingDays;
    const absentDeduction = parseFloat((perDay * absentDays).toFixed(2));
    const recorded = member.salaryHistory.find(s => s.month === m && s.year === y);

    return {
      _id: member._id,
      employeeId: member.employeeId,
      name: member.user?.name || '—',
      designation: member.designation,
      department: member.department,
      dutyStartTime: member.dutyStartTime,
      dutyEndTime: member.dutyEndTime,
      joiningDate: member.joiningDate,
      baseSalary: member.baseSalary,
      absentDays,
      absentDeduction,
      estimatedNet: parseFloat((member.baseSalary - absentDeduction).toFixed(2)),
      recorded: recorded || null,
    };
  });

  res.json({ success: true, month: m, year: y, data: summary });
});

// @desc  Get attendance summary for today
// @route GET /api/staff/attendance/today
const getTodayAttendance = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const staff = await Staff.find({ isActive: true }).populate('user', 'name role');

  const summary = staff.map((member) => {
    const todayRecord = member.attendance.find(
      (a) => new Date(a.date).toISOString().split('T')[0] === today
    );
    return {
      _id: member._id,
      employeeId: member.employeeId,
      name: member.user?.name || '—',
      role: member.user?.role,
      designation: member.designation,
      department: member.department,
      dutyStartTime: member.dutyStartTime,
      dutyEndTime: member.dutyEndTime,
      attendance: todayRecord || null,
    };
  });

  res.json({ success: true, data: summary });
});

module.exports = {
  getStaff,
  getStaffMember,
  createStaff,
  updateStaff,
  deleteStaff,
  markAttendance,
  recordSalary,
  getTodayAttendance,
  getMonthlySalarySummary,
};
