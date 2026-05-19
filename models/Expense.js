const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: {
    type: String,
    enum: ['Utilities', 'Rent', 'Supplies', 'Marketing', 'Maintenance', 'Salary', 'Ingredients', 'Other'],
    required: true,
  },
  date: { type: Date, default: Date.now },
  notes: { type: String },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
