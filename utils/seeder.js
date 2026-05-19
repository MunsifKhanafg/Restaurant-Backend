/**
 * seeder.js — wipes all users and re-creates them with correctly hashed passwords.
 * Run with:  npm run seed
 * The User model's pre-save hook handles bcrypt hashing automatically.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User    = require('../models/User');
const Product = require('../models/Product');

const USERS = [
  { name: 'Admin User',   email: 'admin@aurumdining.com',    password: 'admin123',    role: 'admin'   },
  { name: 'Manager Sara', email: 'manager@aurumdining.com',  password: 'manager123',  role: 'manager' },
  { name: 'Waiter Ali',   email: 'waiter@aurumdining.com',   password: 'waiter123',   role: 'waiter'  },
  { name: 'Chef Hassan',  email: 'chef@aurumdining.com',     password: 'chef123',     role: 'chef'    },
  { name: 'Driver Usman', email: 'driver@aurumdining.com',   password: 'driver123',   role: 'driver'  },
  { name: 'Customer',     email: 'customer@aurumdining.com', password: 'customer123', role: 'waiter'  },
];

const PRODUCTS = [
  { name: 'Chicken Tikka',     price: 650,  costPrice: 320, category: 'Grill & BBQ',  cookingTime: 20, initialStock: 50,  currentStock: 50,  spiceLevel: 'hot',    isVegetarian: false },
  { name: 'Beef Karahi',       price: 850,  costPrice: 420, category: 'Main Course',  cookingTime: 30, initialStock: 40,  currentStock: 40,  spiceLevel: 'hot',    isVegetarian: false },
  { name: 'Vegetable Biryani', price: 420,  costPrice: 180, category: 'Pasta & Rice', cookingTime: 25, initialStock: 60,  currentStock: 60,  spiceLevel: 'medium', isVegetarian: true  },
  { name: 'Seekh Kebab',       price: 550,  costPrice: 260, category: 'Starters',     cookingTime: 15, initialStock: 80,  currentStock: 80,  spiceLevel: 'medium', isVegetarian: false },
  { name: 'Naan',              price: 60,   costPrice: 20,  category: 'Main Course',  cookingTime: 8,  initialStock: 200, currentStock: 200, spiceLevel: 'mild',   isVegetarian: true  },
  { name: 'Mango Lassi',       price: 220,  costPrice: 80,  category: 'Beverages',    cookingTime: 5,  initialStock: 100, currentStock: 100, spiceLevel: 'mild',   isVegetarian: true  },
  { name: 'Gulab Jamun',       price: 180,  costPrice: 60,  category: 'Desserts',     cookingTime: 5,  initialStock: 80,  currentStock: 80,  spiceLevel: 'mild',   isVegetarian: true  },
  { name: 'Mutton Chops',      price: 950,  costPrice: 500, category: 'Grill & BBQ',  cookingTime: 35, initialStock: 30,  currentStock: 30,  spiceLevel: 'hot',    isVegetarian: false },
  { name: 'Club Sandwich',     price: 380,  costPrice: 150, category: 'Burgers',      cookingTime: 12, initialStock: 50,  currentStock: 50,  spiceLevel: 'mild',   isVegetarian: false },
  { name: 'Caesar Salad',      price: 320,  costPrice: 130, category: 'Salads',       cookingTime: 8,  initialStock: 40,  currentStock: 40,  spiceLevel: 'mild',   isVegetarian: true  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // ── Wipe existing users so no double-hashed passwords survive ──
    const { deletedCount } = await User.deleteMany({});
    console.log(`🗑️  Cleared ${deletedCount} existing user(s)\n`);

    // ── Create users — pre-save hook hashes passwords automatically ──
    console.log('👤 Creating users...');
    for (const u of USERS) {
      await User.create(u);
      console.log(`   ✔ ${u.email}  [${u.role}]  pwd: ${u.password}`);
    }

    // ── Products (skip if already exist) ──
    console.log('\n🍽️  Seeding menu items...');
    for (const p of PRODUCTS) {
      const exists = await Product.findOne({ name: p.name });
      if (exists) {
        console.log(`   ↳ skip (exists): ${p.name}`);
      } else {
        await Product.create({ ...p, isAvailable: true });
        console.log(`   ✔ ${p.name}  (${p.category})  Rs.${p.price}`);
      }
    }

    console.log('\n🎉 Seeding complete!\n');
    console.log('─────────────────────────────────────────');
    console.log('  Login credentials:');
    USERS.forEach(u => console.log(`  ${u.role.padEnd(8)}  ${u.email}  /  ${u.password}`));
    console.log('─────────────────────────────────────────\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeder error:', err.message);
    process.exit(1);
  }
}

seed();

