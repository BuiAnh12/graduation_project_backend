const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected"))
  .catch(err => {
      console.error("Connection Error:", err);
      process.exit(1); 
  });

const CookingMethodTagSchema = new mongoose.Schema({
  name: { type: String, required: true },
  tag_category_id: { type: mongoose.Schema.Types.ObjectId, ref: "tag_categories" },
});

const CookingMethodTag = mongoose.model("cooking_method_tags", CookingMethodTagSchema);
const exportDir = path.join(__dirname, '..', 'exported_data');
const output_file_path = path.join(exportDir, 'cooking_method_tags.csv');

async function exportCookingMethodTags() {
  try {
    const tags = await CookingMethodTag.find().lean();

    let output = "id,name,tag_category_id\n";
    tags.forEach((tag, index) => {
      const idLabel = tag._id;
      const categoryId = tag.tag_category_id ? "cooking_method_cat" : "";
      output += `${idLabel},${tag.name},${categoryId}\n`;
    });

    const dir = path.dirname(output_file_path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(output_file_path, output, "utf8");
    console.log(`✅ Exported ${tags.length} cooking method tags → ${output_file_path}`);
  } catch (err) {
    console.error("❌ Error exporting:", err);
  } finally {
    mongoose.disconnect();
  }
}

exportCookingMethodTags();
