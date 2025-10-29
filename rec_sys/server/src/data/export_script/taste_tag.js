const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const TasteTagSchema = new mongoose.Schema({
  name: { type: String, required: true },
  kind: { type: String, required: true },
  level: { type: Number, required: true, min: 0 },
  tag_category_id: { type: mongoose.Schema.Types.ObjectId, ref: "tag_categories" },
});

const TasteTag = mongoose.model("taste_tags", TasteTagSchema);
const output_file_path = path.join("../exported_data", "taste_tags.csv");

async function exportTasteTags() {
  try {
    const tags = await TasteTag.find().lean();

    let output = "id,name,kind,level,tag_category_id\n";
    tags.forEach((tag, index) => {
      const id = tag._id;
      const categoryId = tag.tag_category_id ? "taste_cat" : "";
      output += `${id},${tag.name},${tag.kind},${tag.level},${categoryId}\n`;
    });

    const dir = path.dirname(output_file_path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(output_file_path, output, "utf8");
    console.log(`✅ Exported ${tags.length} taste tags → ${output_file_path}`);
  } catch (err) {
    console.error("❌ Error exporting:", err);
  } finally {
    mongoose.disconnect();
  }
}

exportTasteTags();
