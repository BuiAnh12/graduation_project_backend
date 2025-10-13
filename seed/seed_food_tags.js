const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const FoodTag = require("../models/food_tags.model");
const TagCategory = require("../models/tag_categories.model"); // nhớ chỉnh đúng path

const MONGO_URI = process.env.MONGODB_URL;

async function seedFoodTags() {
  const foods = [
    "thịt gà",
    "thịt bò",
    "thịt heo",
    "cá",
    "tôm",
    "cua",
    "đậu hũ",
    "tempeh",
    "trứng",
    "vịt",
    "thịt cừu",
    "đậu",
    "cơm",
    "mì",
    "bánh mì",
    "mì ống",
    "hạt diêm mạch",
    "yến mạch",
    "bắp",
    "khoai tây",
    "khoai lang",
    "bột năng",
    "cà chua",
    "hành tây",
    "tỏi",
    "cà rốt",
    "bắp cải",
    "xà lách",
    "rau chân vịt",
    "cải xoăn",
    "bông cải xanh",
    "súp lơ",
    "ớt chuông",
    "nấm",
    "bí ngòi",
    "cà tím",
    "đậu bắp",
    "chuối",
    "táo",
    "xoài",
    "dứa",
    "cam",
    "chanh vàng",
    "chanh xanh",
    "dâu tây",
    "bơ",
    "đu đủ",
    "sữa",
    "phô mai",
    "sữa chua",
    "bơ",
    "kem",
    "nước cốt dừa",
    "sữa hạnh nhân",
    "sữa đậu nành",
    "dầu ô liu",
    "dầu thực vật",
    "dầu mè",
    "dầu cá",
    "mỡ heo",
    "bơ ghee",
    "muối",
    "tiêu",
    "ớt",
    "húng quế",
    "ngò",
    "rau mùi tây",
    "gừng",
    "nghệ",
    "sả",
    "quế",
    "hoa hồi",
    "bột cà ri",
    "nước tương",
    "nước mắm",
    "dầu hào",
    "tương hột",
    "tương ớt",
    "tương cà",
    "sốt mayonnaise",
    "mù tạt",
    "giấm",
    "sốt đậu phộng",
    "đường",
    "mật ong",
    "siro cây phong",
    "cỏ ngọt",
    "đậu phộng",
    "hạt điều",
    "hạnh nhân",
    "óc chó",
    "hạt mè",
    "hạt chia",
    "hạt hướng dương",
    "bột ngọt",
    "muối nở",
    "men nở",
    "gelatin",
    "bột bắp",
  ];

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 🔍 Kiểm tra hoặc tạo tag category "Food"
    let foodCategory = await TagCategory.findOne({ name: "Food" });
    if (!foodCategory) {
      foodCategory = await TagCategory.create({ name: "Food" });
      console.log("🆕 Created Tag Category: Food");
    }

    for (const name of foods) {
      const existingTag = await FoodTag.findOne({ name });
      if (existingTag) {
        console.log(`⚠️  ${name} already exists, skipping...`);
        continue;
      }

      await FoodTag.create({
        name,
        tag_category_id: foodCategory._id,
      });

      console.log(`✅ Created food tag: ${name}`);
    }

    console.log("🎉 Done seeding food tags!");
    await mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error seeding food tags:", err);
    await mongoose.connection.close();
  }
}

seedFoodTags();
