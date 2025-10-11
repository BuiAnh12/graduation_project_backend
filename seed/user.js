const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/users.model"); // chỉnh đúng đường dẫn models/user.js
const Account = require("../models/accounts.model"); // chỉnh đúng đường dẫn models/account.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGODB_URL;

async function seedDatabase() {
  console.log("🔍 MONGO_URI =", process.env.MONGODB_URL);
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const genders = ["Male", "Female"];
    const hashedPassword = await bcrypt.hash("123456", 10); // hash 1 lần dùng chung

    for (let i = 1; i <= 10; i++) {
      const email = `customer${i}@gmail.com`;

      // Kiểm tra user đã tồn tại
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log(`⚠️  ${email} already exists, skipping...`);
        continue;
      }

      // Tạo account
      const account = await Account.create({
        password: hashedPassword,
        isGoogleLogin: false,
        blocked: false,
      });

      // Tạo user
      const user = await User.create({
        accountId: account._id,
        name: `Customer ${i}`,
        email,
        phonenumber: `09000000${i}`,
        gender: genders[i % 2],
      });

      console.log(`✅ Created: ${user.name} (${email})`);
    }

    console.log("🎉 Done seeding users!");
    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    mongoose.connection.close();
  }
}

seedDatabase();
