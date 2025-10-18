const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config(); // optional if using .env for Mongo URI

// 1️⃣ Connect to MongoDB
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// 2️⃣ Define your schema (or import your model)
const FoodTagSchema = new mongoose.Schema({
  name: String,
  tag_category_id: { type: mongoose.Schema.Types.ObjectId, ref: "tag_categories" },
});

const FoodTag = mongoose.model("food_tags", FoodTagSchema);

// 3️⃣ Define output path
const output_file_path = path.join("exported_data", "food_tags.csv");

// 4️⃣ Exporter logic
async function exportFoodTags() {
  try {
    const tags = await FoodTag.find().lean();

    let output = "id,name,tag_category_id\n";
    tags.forEach((tag, index) => {
      const idLabel = `food_tag_${index + 1}`;
      const categoryId = tag.tag_category_id ? "food_cat" : "";
      output += `${idLabel},${tag.name},${categoryId}\n`;
    });

    // 🗂️ Ensure folder exists
    const dir = path.dirname(output_file_path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created folder: ${dir}`);
    }

    // 💾 Save to file
    fs.writeFileSync(output_file_path, output, "utf8");
    console.log(`✅ Export complete → ${output_file_path}`);
  } catch (err) {
    console.error("❌ Error exporting:", err);
  } finally {
    mongoose.disconnect();
  }
}

exportFoodTags();
