const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'half-day'], default: 'present' },
  checkIn: { type: String },
  checkOut: { type: String },
  notes: { type: String },
});

const salarySchema = new mongoose.Schema({
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  baseSalary: { type: Number, required: true },
  bonus: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  absentDeduction: { type: Number, default: 0 },
  netSalary: { type: Number },
  paid: { type: Boolean, default: false },
  paidDate: { type: Date },
});

const staffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeId: { type: String, unique: true },
  designation: { type: String, required: true },
  department: {
    type: String,
    enum: ['Kitchen', 'Service', 'Management', 'Delivery', 'Accounts', 'Maintenance'],
    required: true,
  },
  baseSalary: { type: Number, required: true },
  joiningDate: { type: Date, default: Date.now },
  // Duty timing (especially for waiters and kitchen staff)
  dutyStartTime: { type: String, default: '09:00' },
  dutyEndTime: { type: String, default: '18:00' },
  attendance: [attendanceSchema],
  salaryHistory: [salarySchema],
  emergencyContact: { type: String },
  address: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

staffSchema.pre('save', function (next) {
  if (!this.employeeId) {
    this.employeeId = 'EMP-' + Date.now().toString().slice(-6);
  }
  next();
});

module.exports = mongoose.model('Staff', staffSchema);
