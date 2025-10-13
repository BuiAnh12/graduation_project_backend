const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const CultureTag = require("../models/culture_tags.model");
const TagCategory = require("../models/tag_categories.model"); // nhớ đúng path

const MONGO_URI = process.env.MONGODB_URL;

async function seedCultureTags() {
  const cuisines = [
    "Việt Nam",
    "Thái Lan",
    "Trung Quốc",
    "Nhật Bản",
    "Hàn Quốc",
    "Ấn Độ",
    "Malaysia",
    "Indonesia",
    "Singapore",
    "Philippines",
    "Mỹ",
    "Ý",
    "Pháp",
    "Mexico",
  ];

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 🔍 Kiểm tra có tag category 'Cuisine' chưa
    let cuisineCategory = await TagCategory.findOne({ name: "Cuisine" });
    if (!cuisineCategory) {
      cuisineCategory = await TagCategory.create({ name: "Cuisine" });
      console.log("🆕 Created Tag Category: Cuisine");
    }

    for (const name of cuisines) {
      const existingTag = await CultureTag.findOne({ name });
      if (existingTag) {
        console.log(`⚠️  ${name} already exists, skipping...`);
        continue;
      }

      await CultureTag.create({
        name,
        tag_category_id: cuisineCategory._id,
      });

      console.log(`✅ Created culture tag: ${name}`);
    }

    console.log("🎉 Done seeding culture tags!");
    await mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error seeding culture tags:", err);
    await mongoose.connection.close();
  }
}

seedCultureTags();
