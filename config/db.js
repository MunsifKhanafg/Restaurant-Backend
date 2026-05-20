const mongoose = require('mongoose');

const connectDB = async () => {
  // If already connected and connection is ready, reuse it
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', reject);
    });
    return;
  }

  // Catch missing env var immediately — don't wait for a 10s timeout
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not set on this server');
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      maxPoolSize: 10,
      bufferCommands: false,
    });
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    throw new Error(`MongoDB failed to connect: ${error.message}`);
  }
};

module.exports = connectDB;
