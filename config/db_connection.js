const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  const connectWithRetry = async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URL, {
        serverSelectionTimeoutMS: 30000, 
        connectTimeoutMS: 30000,
      });
      console.log("MongoDB Connection Succeeded.");
    } catch (error) {
      console.error("MongoDB connection failed. Retrying in 5 seconds...", error.message);
      setTimeout(connectWithRetry, 5000);
    }
  };

  await connectWithRetry();
};

module.exports = connectDB;
