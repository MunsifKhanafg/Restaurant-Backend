const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// POST /api/auth/register  — create individual account
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  const exists = await User.findOne({ email });
  if (exists) { res.status(400); throw new Error('User already exists'); }
  const user = await User.create({ name, email, password, role, phone });
  res.status(201).json({
    success: true,
    data: { _id: user._id, name: user.name, email: user.email, role: user.role },
    token: generateToken(user._id),
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    res.status(401); throw new Error('Invalid email or password');
  }
  if (!user.isActive) { res.status(403); throw new Error('Account is deactivated'); }
  res.json({
    success: true,
    data: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    token: generateToken(user._id),
  });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

// GET /api/auth/users
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort('role');
  res.json({ success: true, count: users.length, data: users });
});

// PUT /api/auth/users/:id  — update one specific user
const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, phone, isActive, password } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  if (name)                user.name     = name;
  if (email)               user.email    = email;
  if (role)                user.role     = role;
  if (phone  !== undefined) user.phone   = phone;
  if (isActive !== undefined) user.isActive = isActive;
  if (password && password.length >= 6) user.password = password;
  await user.save();
  res.json({ success: true, data: { _id: user._id, name: user.name, email: user.email, role: user.role } });
});

// PUT /api/auth/users/role/:role  — update email + password for ALL users of a role
// This is the "shared credentials" endpoint used by Settings → Login Credentials
const updateRoleCredentials = asyncHandler(async (req, res) => {
  const { role } = req.params;
  const { email, password } = req.body;

  const VALID_ROLES = ['admin', 'manager', 'waiter', 'chef', 'driver'];
  if (!VALID_ROLES.includes(role)) {
    res.status(400); throw new Error(`Invalid role: ${role}`);
  }
  if (!email && !password) {
    res.status(400); throw new Error('Provide at least a new email or password');
  }
  if (password && password.length < 6) {
    res.status(400); throw new Error('Password must be at least 6 characters');
  }
  if (email) {
    // Check email isn't already taken by a user of a DIFFERENT role
    const conflict = await User.findOne({ email, role: { $ne: role } });
    if (conflict) {
      res.status(400); throw new Error(`Email "${email}" is already in use by a ${conflict.role} account`);
    }
  }

  const users = await User.find({ role });
  if (users.length === 0) {
    res.status(404); throw new Error(`No users found with role "${role}"`);
  }

  // Update each user — let the pre-save hook hash the password
  for (const u of users) {
    if (email)    u.email    = email.toLowerCase().trim();
    if (password) u.password = password;   // pre-save hook will hash it
    await u.save();
  }

  res.json({
    success: true,
    message: `Updated credentials for ${users.length} ${role} account(s)`,
    data: { role, email: email || users[0].email, usersUpdated: users.length },
  });
});

// DELETE /api/auth/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  if (user._id.toString() === req.user._id.toString()) {
    res.status(400); throw new Error('Cannot delete your own account');
  }
  await user.deleteOne();
  res.json({ success: true, message: 'User removed' });
});

module.exports = { register, login, getMe, getAllUsers, updateUser, updateRoleCredentials, deleteUser };
