const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const TasteTag = require("../models/taste_tags.model");
const TagCategory = require("../models/tag_categories.model"); // chỉnh đúng path

const MONGO_URI = process.env.MONGODB_URL;

async function seedTasteTags() {
  const tastes = {
    spiciness: [
      "không cay",
      "cay nhẹ",
      "cay vừa",
      "cay nhiều",
      "cay cực độ",
      "không ớt",
    ],
    sweetness: [
      "không ngọt",
      "ít ngọt",
      "ngọt vừa",
      "ngọt nhiều",
      "không đường",
      "ít đường",
    ],
    sourness: ["không chua", "hơi chua", "chua", "vị chua từ cam chanh"],
    saltiness: ["không muối", "ít muối", "vừa muối", "mặn"],
    umami: ["ít đậm đà", "đậm đà", "vị lên men"],
    bitterness: ["đắng", "không đắng"],
    richness: ["nhẹ", "béo nhẹ", "béo ngậy", "không sữa"],
    aroma: ["trung tính", "thơm thảo mộc", "thơm gia vị", "thơm đặc trưng"],
  };

  const kindMapping = {
    spiciness: "Cay",
    sweetness: "Ngọt",
    sourness: "Chua",
    saltiness: "Mặn",
    umami: "Đậm đà",
    bitterness: "Đắng",
    richness: "Béo",
    aroma: "Hương thơm",
  };

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 🔍 Tạo category "Taste" nếu chưa có
    let tasteCategory = await TagCategory.findOne({ name: "Taste" });
    if (!tasteCategory) {
      tasteCategory = await TagCategory.create({ name: "Taste" });
      console.log("🆕 Created Tag Category: Taste");
    }

    for (const [key, values] of Object.entries(tastes)) {
      const kind = kindMapping[key] || key;
      console.log(`\n🍽️  Seeding kind: ${kind}`);

      for (let i = 0; i < values.length; i++) {
        const name = values[i];
        const level = i; // chỉ số trong mảng = level

        const existing = await TasteTag.findOne({ name, kind });
        if (existing) {
          console.log(`⚠️  ${name} (${kind}) already exists, skipping...`);
          continue;
        }

        await TasteTag.create({
          name,
          kind,
          level,
          tag_category_id: tasteCategory._id,
        });

        console.log(`✅ Created: ${name} (${kind}, level ${level})`);
      }
    }

    console.log("\n🎉 Done seeding taste tags!");
    await mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error seeding taste tags:", err);
    await mongoose.connection.close();
  }
}

seedTasteTags();
