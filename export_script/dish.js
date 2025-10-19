const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// 🧩 Define Schemas (minimal for export)
const Dish = require("../models/dishes.model")
require("../models/categories.model");
require("../models/stores.model");
require("../models/food_tags.model");
require("../models/taste_tags.model");
require("../models/cooking_method_tags.model");
require("../models/culture_tags.model");

// 🗂️ Output file path
const output_file_path = path.join("exported_data", "dishes.csv");

// 💡 Helper to map IDs to CSV-style labels
function formatTagList(tags, prefix) {
  if (!tags || tags.length === 0) return "[]";
  return `["${tags.map((_, i) => `${prefix}_${i + 1}`).join('", "')}"]`;
}

// 🚀 Export logic
async function exportDishes() {
  try {
    const dishes = await Dish.find()
      .populate("category", "name")
      .populate("storeId", "name")
      .populate("dishTags", "name")
      .populate("tasteTags", "name")
      .populate("cookingMethodtags", "name")
      .populate("cultureTags", "name")
      .lean();

    let output = "id,name,description,price,category,store_id,stock_status,stock_count,rating,created_at,updated_at,food_tags,taste_tags,cooking_method_tags,culture_tags\n";

    dishes.forEach((dish, index) => {
      const id = dish._id;
      const name = dish.name?.replace(/,/g, " ") || "";
      const description = dish.description?.replace(/,/g, " ") || "";
      const price = dish.price || 0;
      const category = dish.category?.name || "";
      const storeId = dish.storeId ? `store_${index + 1}` : "";
      const stockStatus = dish.stockStatus || "available";
      const stockCount = dish.stockCount ?? "";
      const rating = (3.5 + Math.random() * 1.5).toFixed(1); // mock rating
      const created_at = dish.createdAt?.toISOString().replace("T", " ").replace("Z", "") || "";
      const updated_at = dish.updatedAt?.toISOString().replace("T", " ").replace("Z", "") || "";

      // Convert tag arrays to labeled CSV lists
      const food_tags = `["${(dish.dishTags || []).map((_, i) => `food_tag_${i + 1}`).join('", "')}"]`;
      const taste_tags = `["${(dish.tasteTags || []).map((_, i) => `taste_tag_${i + 1}`).join('", "')}"]`;
      const cooking_tags = `["${(dish.cookingMethodtags || []).map((_, i) => `cooking_tag_${i + 1}`).join('", "')}"]`;
      const culture_tags = `["${(dish.cultureTags || []).map((_, i) => `culture_tag_${i + 1}`).join('", "')}"]`;

      output += `${id},${name},${description},${price},${category},${storeId},${stockStatus},${stockCount},${rating},${created_at},${updated_at},${food_tags},${taste_tags},${cooking_tags},${culture_tags}\n`;
    });

    // Ensure export folder exists
    const dir = path.dirname(output_file_path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(output_file_path, output, "utf8");
    console.log(`✅ Exported ${dishes.length} dishes → ${output_file_path}`);
  } catch (err) {
    console.error("❌ Error exporting dishes:", err);
  } finally {
    mongoose.disconnect();
  }
}

exportDishes();
