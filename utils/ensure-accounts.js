/**
 * ensure-accounts.js
 * Creates the admin and customer quick-login accounts if they don't exist.
 * Safe to run any time — it NEVER deletes or modifies existing accounts.
 *
 * Run with:  node utils/ensure-accounts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const ACCOUNTS = [
  { name: 'Admin User', email: 'admin@aurumdining.com',    password: 'admin123',    role: 'admin'  },
  { name: 'Customer',   email: 'customer@aurumdining.com', password: 'customer123', role: 'waiter' },
];

async function ensureAccounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    for (const acc of ACCOUNTS) {
      const exists = await User.findOne({ email: acc.email });
      if (exists) {
        console.log(`   ↳ already exists: ${acc.email}  [${acc.role}]`);
      } else {
        await User.create(acc); // pre-save hook hashes password automatically
        console.log(`   ✔ created: ${acc.email}  [${acc.role}]  pwd: ${acc.password}`);
      }
    }

    console.log('\n─────────────────────────────────────────');
    console.log('  Quick-login credentials:');
    ACCOUNTS.forEach(a => console.log(`  ${a.role.padEnd(8)}  ${a.email}  /  ${a.password}`));
    console.log('─────────────────────────────────────────\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

ensureAccounts();
