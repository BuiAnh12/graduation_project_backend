const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const CookingMethodTag = require("../models/cooking_method_tags.model");
const TagCategory = require("../models/tag_categories.model"); // nhớ chỉnh đúng path

const MONGO_URI = process.env.MONGODB_URL;

async function seedCookingMethodTags() {
  const methods = [
    "sống","ướp","luộc","nấu nhỏ lửa","hấp","chần","trụng","xào",
    "rán chảo","chiên ngập dầu","nướng","quay","nướng lò","om","hầm","hun khói","áp chảo"
  ];

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 🔍 Kiểm tra hoặc tạo tag category "Cooking Method"
    let methodCategory = await TagCategory.findOne({ name: "Cooking Method" });
    if (!methodCategory) {
      methodCategory = await TagCategory.create({ name: "Cooking Method" });
      console.log("🆕 Created Tag Category: Cooking Method");
    }

    for (const name of methods) {
      const existingTag = await CookingMethodTag.findOne({ name });
      if (existingTag) {
        console.log(`⚠️  ${name} already exists, skipping...`);
        continue;
      }

      await CookingMethodTag.create({
        name,
        tag_category_id: methodCategory._id,
      });

      console.log(`✅ Created cooking method tag: ${name}`);
    }

    console.log("🎉 Done seeding cooking method tags!");
    await mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error seeding cooking method tags:", err);
    await mongoose.connection.close();
  }
}

seedCookingMethodTags();
