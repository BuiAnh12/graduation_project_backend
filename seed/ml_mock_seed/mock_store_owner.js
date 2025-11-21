const mongoose = require('mongoose');
const Staff = require('../../models/staffs.model'); // Using your specified path
require("dotenv").config();

// --- Configuration ---
// IMPORTANT: Replace this with your actual MongoDB connection string
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";

// --- Data ---
// Your data, converted from EJSON to Mongoose-compatible format
const staffData = [
  {
    _id: "68f305ace2da7af438656b0c", // Mongoose will cast string to ObjectId
    accountId: "68dfd3e078fa936ef7ac0446",
    role: ["STORE_OWNER"],
    name: "Viet Namese Store owner",
    email: "storevietnam@gmail.com",
    phonenumber: "0932111111",
    gender: "male",
    createdAt: new Date("2025-10-03T13:47:12.323Z"), // Use native Date objects
    updatedAt: new Date("2025-10-17T16:03:56.385Z"),
    otp: null,
    otpExpires: null,
    avatarImage: "68f268ec685b9d7887497c51"
  },
  {
    _id: "68f305d8e2da7af438656b13",
    accountId: "68dfd3e078fa936ef7ac0446",
    role: ["STORE_OWNER"],
    name: "Asia Fusion Store",
    email: "asianfutionstore@gmail.com",
    phonenumber: "0932111111",
    gender: "male",
    createdAt: new Date("2025-10-03T13:47:12.323Z"),
    updatedAt: new Date("2025-10-17T16:03:56.385Z"),
    otp: null,
    otpExpires: null,
    avatarImage: "68f268ec685b9d7887497c51"
  }
];

// --- Seeder Function ---
async function seedDatabase() {
  try {
    // 1. Connect to MongoDB
    mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected"))
  .catch(err => {
      console.error("Connection Error:", err);
      process.exit(1); 
  });
    console.log("MongoDB connected for seeding staff...");

    // 2. Make the seed repeatable by deleting existing entries with these IDs
    const staffEmail = staffData.map(s => s.email);
    await Staff.deleteMany({ email: { $in: staffEmail } });
    console.log("Removed old staff data.");

    // 3. Insert the new staff data
    await Staff.insertMany(staffData);
    console.log("Successfully seeded 2 staff members. ✅");

  } catch (error) {
    console.error("Error seeding staff data: ❌", error.message);
  } finally {
    // 4. Disconnect from the database
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

// Run the seeder function
seedDatabase();