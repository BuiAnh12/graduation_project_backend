const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// 🧩 Define Store schema (minimal subset for export)
const StoreSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  location: { type: mongoose.Schema.Types.Mixed }, // { type: "Point", coordinates: [lng, lat] }
  address_full: { type: String },
});

const Store = mongoose.model("stores", StoreSchema);

// 🗂️ Output file path
const output_file_path = path.join("exported_data", "stores.csv");

// 💡 Helper: mock data for price_range and rating if not stored in DB
function randomPriceRange() {
  const ranges = ["budget", "mid", "premium"];
  return ranges[Math.floor(Math.random() * ranges.length)];
}

function randomRating() {
  return (3.5 + Math.random() * 1.5).toFixed(1); // between 3.5 and 5.0
}

// 🚀 Export logic
async function exportStores() {
  try {
    const stores = await Store.find().lean();

    let output = "id,name,description,price_range,rating,location\n";

    stores.forEach((store, index) => {
      const id = store._id
      const name = store.name?.replace(/,/g, " ") || "";
      const description = store.description?.replace(/,/g, " ") || "";
      const price_range = randomPriceRange();
      const rating = randomRating();

      // Prefer human-readable address, fallback to empty
      const location = store.address_full ? `"${store.address_full}"` : "";

      output += `${id},${name},${description},${price_range},${rating},${location}\n`;
    });

    // Ensure export folder exists
    const dir = path.dirname(output_file_path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Save
    fs.writeFileSync(output_file_path, output, "utf8");
    console.log(`✅ Exported ${stores.length} stores → ${output_file_path}`);
  } catch (err) {
    console.error("❌ Error exporting stores:", err);
  } finally {
    mongoose.disconnect();
  }
}

exportStores();