const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');
const inventoryRoutes = require('./routes/inventory');
const staffRoutes = require('./routes/staff');
const paymentConfigRoutes = require('./routes/paymentConfig');
const restaurantConfigRoutes = require('./routes/restaurantConfig');

// Connect Database and auto-seed if empty
const autoSeed = async () => {
  try {
    const User = require('./models/User');
    const count = await User.countDocuments({});
    if (count === 0) {
      console.log('⚠️  No users found — running auto-seed...');
      // inline seed so we don't spawn a child process
      // Let the User model's pre-save hook handle hashing — do NOT pre-hash here
      const SEED_USERS = [
        { name: 'Admin User',     email: 'admin@aurumdining.com',    password: 'admin123',    role: 'admin'   },
        { name: 'Manager Sara',   email: 'manager@aurumdining.com',  password: 'manager123',  role: 'manager' },
        { name: 'Waiter Ali',     email: 'waiter@aurumdining.com',   password: 'waiter123',   role: 'waiter'  },
        { name: 'Chef Hassan',    email: 'chef@aurumdining.com',     password: 'chef123',     role: 'chef'    },
        { name: 'Driver Usman',   email: 'driver@aurumdining.com',   password: 'driver123',   role: 'driver'  },
        { name: 'Customer',       email: 'customer@aurumdining.com', password: 'customer123', role: 'waiter'  },
      ];
      for (const u of SEED_USERS) {
        await User.create(u);   // pre-save hook hashes the password automatically
        console.log(`  ✔ seeded: ${u.email} [${u.role}]`);
      }
      console.log('✅ Auto-seed complete!');
    } else {
      console.log(`✅ ${count} user(s) already in DB — skipping seed.`);
      // Always ensure the two quick-login accounts exist
      const ENSURE_USERS = [
        { name: 'Admin User', email: 'admin@aurumdining.com',    password: 'admin123',    role: 'admin'  },
        { name: 'Customer',   email: 'customer@aurumdining.com', password: 'customer123', role: 'waiter' },
      ];
      for (const u of ENSURE_USERS) {
        const exists = await User.findOne({ email: u.email });
        if (!exists) {
          await User.create(u);
          console.log(`  ✔ ensured quick-login account: ${u.email} [${u.role}]`);
        }
      }
    }
  } catch (err) {
    console.error('⚠️  Auto-seed error:', err.message);
  }
};

// Initial connection attempt + seed
connectDB().then(autoSeed).catch(err => console.error('Startup DB error:', err.message));

const app = express();
const server = http.createServer(app);

// Socket.io setup
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  'https://restaurant-frontend-five-psi.vercel.app',
  'https://restaurant-frontend-git-main-munsifkhanafgs-projects.vercel.app',
  'http://localhost:3000',
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Store io instance on app
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('joinRoom', (room) => {
    socket.join(room);
    console.log(`📺 Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('orderStatusUpdate', (data) => {
    io.emit('orderStatusUpdate', data);
  });

  socket.on('kitchenUpdate', (data) => {
    io.to('admin').emit('kitchenUpdate', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Middleware
// Ensure DB is connected on every request (critical for Vercel serverless)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection failed on request:', err.message);
    res.status(503).json({ success: false, message: 'Database unavailable, please try again.' });
  }
});

app.use(cors({
  origin: function(origin, callback) {
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/payment-config', paymentConfigRoutes);
app.use('/api/restaurant-config', restaurantConfigRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '🍽️ Restaurant API is running', timestamp: new Date() });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Export for Vercel serverless
module.exports = app;

// Also listen locally (ignored by Vercel)
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📡 Socket.io active`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/health\n`);
  });
}
