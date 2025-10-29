const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const CultureTagSchema = new mongoose.Schema({
  name: { type: String, required: true },
  tag_category_id: { type: mongoose.Schema.Types.ObjectId, ref: "tag_categories" },
});

const CultureTag = mongoose.model("culture_tags", CultureTagSchema);
const output_file_path = path.join("../exported_data", "culture_tags.csv");

async function exportCultureTags() {
  try {
    const tags = await CultureTag.find().lean();

    let output = "id,name,tag_category_id\n";
    tags.forEach((tag, index) => {
      const idLabel = tag._id;
      const categoryId = tag.tag_category_id ? "culture_cat" : "";
      output += `${idLabel},${tag.name},${categoryId}\n`;
    });

    const dir = path.dirname(output_file_path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(output_file_path, output, "utf8");
    console.log(`✅ Exported ${tags.length} culture tags → ${output_file_path}`);
  } catch (err) {
    console.error("❌ Error exporting:", err);
  } finally {
    mongoose.disconnect();
  }
}

exportCultureTags();
