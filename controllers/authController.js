const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// @desc  Register user
// @route POST /api/auth/register
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

// @desc  Login user
// @route POST /api/auth/login
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

// @desc  Get current user
// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

// @desc  Get all users (admin/manager)
// @route GET /api/auth/users
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort('-createdAt');
  res.json({ success: true, count: users.length, data: users });
});

// @desc  Update user (admin)
// @route PUT /api/auth/users/:id
const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, phone, isActive, password } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  if (name) user.name = name;
  if (email) user.email = email;
  if (role) user.role = role;
  if (phone !== undefined) user.phone = phone;
  if (isActive !== undefined) user.isActive = isActive;
  if (password && password.length >= 6) user.password = password;
  await user.save();
  res.json({ success: true, data: { _id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive } });
});

// @desc  Delete user (admin)
// @route DELETE /api/auth/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  if (user._id.toString() === req.user._id.toString()) {
    res.status(400); throw new Error('Cannot delete your own account');
  }
  await user.deleteOne();
  res.json({ success: true, message: 'User removed' });
});

module.exports = { register, login, getMe, getAllUsers, updateUser, deleteUser };
