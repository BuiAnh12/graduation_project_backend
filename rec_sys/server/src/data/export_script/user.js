const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
console.log(MONGO_URI)
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected"))
  .catch(err => {
      console.error("Connection Error:", err);
      process.exit(1); 
  });

// 🧩 Load Dependent Models (Required for Populate to work)
require("../../../../../models/categories.model");
require("../../../../../models/stores.model");
require("../../../../../models/food_tags.model");
require("../../../../../models/taste_tags.model");
require("../../../../../models/cooking_method_tags.model");
require("../../../../../models/culture_tags.model");

// 🧩 Define Schemas
const UserReference = require("../../../../../models/user_references.model");
const User = require("../../../../../models/users.model");

// 🗂️ Output file path
const exportDir = path.join(__dirname, '..', 'exported_data');
const output_file_path = path.join(exportDir, 'users.csv');


// 🧮 Helper: Extract and Flatten Tags
// This takes the UserReference object and a list of fields (e.g., ['like_food', 'like_taste'])
// and returns a single combined list of tag names (e.g., ['Pizza', 'Spicy', 'Italian'])
function getCombinedTags(reference, fields) {
  if (!reference) return [];
  
  let combined = [];
  fields.forEach(field => {
    if (reference[field] && Array.isArray(reference[field])) {
      // Map objects to their 'name' property
      const names = reference[field].map(tag => tag.name).filter(n => n);
      combined = combined.concat(names);
    }
  });
  // Remove duplicates
  return [...new Set(combined)];
}

// 🧮 Helper: Format for CSV
// Converts array ['A', 'B'] to string "['A', 'B']" compatible with Python AST
function formatForCsv(array) {
  return `"${JSON.stringify(array).replace(/"/g, "'")}"`;
}

// 🚀 Export logic
async function exportUsers() {
  try {
    console.log("⏳ Fetching users and populating references...");

    const users = await User.find()
      .populate({
        path: "user_reference_id",
        populate: [
          // --- Populate Allergies ---
          { path: "allergy", select: "name" },
          
          // --- Populate Likes ---
          { path: "like_food", select: "name" },
          { path: "like_taste", select: "name" },
          { path: "like_culture", select: "name" },
          { path: "like_cooking_method", select: "name" },

          // --- Populate Dislikes ---
          { path: "dislike_food", select: "name" },
          { path: "dislike_taste", select: "name" },
          { path: "dislike_culture", select: "name" },
          { path: "dislike_cooking_method", select: "name" },
        ],
      })
      .lean();

    // 📝 New CSV Header: We removed 'preferences' and added explicit columns
    let output = "id,name,age,gender,location,liked_tags,disliked_tags,allergy_tags\n";

    users.forEach((user, index) => {
      const id = user._id;
      const name = user.name || "Anonymous";
      const gender = user.gender || "unknown";
      const location = ""; // Placeholder
      
      // Mock Age Logic (Keep as is for now)
      const age = 20 + (index % 10) + 1; 

      const ref = user.user_reference_id;

      // 1. Flatten LIKES (Food + Taste + Culture + Method)
      const likedTags = getCombinedTags(ref, [
        'like_food', 'like_taste', 'like_culture', 'like_cooking_method'
      ]);

      // 2. Flatten DISLIKES (Food + Taste + Culture + Method)
      const dislikedTags = getCombinedTags(ref, [
        'dislike_food', 'dislike_taste', 'dislike_culture', 'dislike_cooking_method'
      ]);

      // 3. Flatten ALLERGIES
      const allergyTags = getCombinedTags(ref, ['allergy']);

      // Add row to output
      output += `${id},${name},${age},${gender},"${location}",${formatForCsv(likedTags)},${formatForCsv(dislikedTags)},${formatForCsv(allergyTags)}\n`;
    });

    // Ensure export folder exists
    const dir = path.dirname(output_file_path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Save
    fs.writeFileSync(output_file_path, output, "utf8");
    console.log(`✅ Exported ${users.length} users → ${output_file_path}`);
    console.log(`   Structure: id, name, age, gender, location, liked_tags, disliked_tags, allergy_tags`);

  } catch (err) {
    console.error("❌ Error exporting users:", err);
  } finally {
    mongoose.disconnect();
  }
}

exportUsers();