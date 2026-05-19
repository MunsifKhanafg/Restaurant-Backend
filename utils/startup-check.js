/**
 * startup-check.js — run once before starting server in development
 * Checks MongoDB connection and warns if no admin user exists.
 * Usage:  node utils/startup-check.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  MongoDB connected:', mongoose.connection.host);

    const User = require('../models/User');
    const count = await User.countDocuments({});

    if (count === 0) {
      console.log('\n⚠️  NO USERS FOUND IN DATABASE!');
      console.log('   Run:  npm run seed');
      console.log('   This will create demo admin/waiter/chef accounts.\n');
    } else {
      console.log(`✅  Found ${count} user(s) in database.`);
    }

    const Order = require('../models/Order');
    const orderCount = await Order.countDocuments({});
    console.log(`ℹ️   Orders in DB: ${orderCount}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌  Startup check failed:', err.message);
    console.error('    Make sure MongoDB is running and MONGO_URI in .env is correct.');
    process.exit(1);
  }
}

check();
