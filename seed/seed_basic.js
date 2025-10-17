require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");

// Import models (adjust paths to your models folder)
const Account = require("../models/accounts.model");
const User = require("../models/users.model");
const Store = require("../models/stores.model");
const Category = require("../models/categories.model");
const Dish = require("../models/dishes.model");
const Cart = require("../models/carts.model");
const Order = require("../models/orders.model");

const hashPassword = (password, salt) => {
  return crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
};

const runSeeder = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Clear existing data (optional for dev only)
    await Promise.all([
      Account.deleteMany({}),
      User.deleteMany({}),
      Store.deleteMany({}),
      Category.deleteMany({}),
      Dish.deleteMany({}),
      Cart.deleteMany({}),
      Order.deleteMany({}),
    ]);

    // ---------- Create account ----------
    const salt = crypto.randomBytes(16).toString("hex");
    const account = await Account.create({
      username: "demoUser",
      password: hashPassword("123", salt),
      salt: salt, // make sure your Account schema includes this field
      blocked: false,
    });

    // ---------- Create user ----------
    const user = await User.create({
      accountId: account._id,
      name: "John Doe",
      email: "john@example.com",
      phonenumber: "0901234567",
      gender: "male",
    });

    // ---------- Create store ----------
    const store = await Store.create({
      name: "Demo Pizza",
      owner: user._id, // linking user as staff/owner
      description: "Best pizza in town",
      address_full: "123 Main St",
      status: "approved",
      openStatus: "opened",
    });

    // ---------- Create category ----------
    const category = await Category.create({
      name: "Pizza",
      storeId: store._id,
    });

    // ---------- Create dish ----------
    const dish = await Dish.create({
      name: "Margherita Pizza",
      price: 10.99,
      category: category._id,
      storeId: store._id,
      stockStatus: "available",
      stockCount: 50,
    });

    // ---------- Create cart ----------
    const cart = await Cart.create({
      userId: user._id,
      storeId: store._id,
      status: "active",
    });

    // ---------- Create order ----------
    const order = await Order.create({
      userId: user._id,
      storeId: store._id,
      orderNumber: 1,
      status: "pending",
      paymentMethod: "cash",
      subtotalPrice: 10.99,
      finalTotal: 10.99,
      currency: "VND",
    });

    console.log("✅ Seed data created successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

runSeeder();
