const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// 🧩 Define UserReference schema
const UserReferenceSchema = new mongoose.Schema({
  allergy: [{ type: mongoose.Schema.Types.ObjectId, ref: "food_tags" }],
  dislike_taste: [{ type: mongoose.Schema.Types.ObjectId, ref: "taste_tags" }],
  dislike_food: [{ type: mongoose.Schema.Types.ObjectId, ref: "food_tags" }],
  dislike_cooking_method: [{ type: mongoose.Schema.Types.ObjectId, ref: "cooking_method_tags" }],
  dislike_culture: [{ type: mongoose.Schema.Types.ObjectId, ref: "culture_tags" }],
  like_taste: [{ type: mongoose.Schema.Types.ObjectId, ref: "taste_tags" }],
  like_food: [{ type: mongoose.Schema.Types.ObjectId, ref: "food_tags" }],
  like_cooking_method: [{ type: mongoose.Schema.Types.ObjectId, ref: "cooking_method_tags" }],
  like_culture: [{ type: mongoose.Schema.Types.ObjectId, ref: "culture_tags" }],
});

const UserReference = mongoose.model("user_references", UserReferenceSchema);

// 🧩 Define User schema
const UserSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "accounts" },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phonenumber: { type: String },
  gender: { type: String },
  user_reference_id: { type: mongoose.Schema.Types.ObjectId, ref: "user_references" },
  avatarImage: { type: mongoose.Schema.Types.ObjectId, ref: "images" },
});

const User = mongoose.model("users", UserSchema);

// 🗂️ Output file path
const output_file_path = path.join("exported_data", "users.csv");

// 🧮 Helper to build preferences
function buildPreferences(reference) {
  if (!reference) return {};

  // Example fields you might extract from user_references
  const cuisine = reference.like_culture?.map(c => c.name) || [];
  const taste = reference.like_taste?.map(t => t.name) || [];
  const food = reference.like_food?.map(f => f.name) || [];
  const cooking_method = reference.like_cooking_method?.map(m => m.name) || [];

  // Combine to a readable preferences object
  return {
    cuisine,
    taste,
    food,
    cooking_method
  };
}

// 🚀 Export logic
async function exportUsers() {
  try {
    const users = await User.find()
      .populate({
        path: "user_reference_id",
        populate: [
          { path: "like_food", select: "name" },
          { path: "like_taste", select: "name" },
          { path: "like_culture", select: "name" },
          { path: "like_cooking_method", select: "name" },
        ],
      })
      .lean();

    let output = "id,name,age,gender,location,preferences,behavior\n";

    users.forEach((user, index) => {
      const id = user._id
      const name = user.name || "";
      const gender = user.gender || "";
      const location = ""; // can fill in later if you have address/location info
      const behavior = ""; // placeholder for future field like "health_conscious"

      // You can compute or assign fake ages for now
      const age = 20 + (index % 10) + 1; // just a mock distribution 21–30

      const preferences = buildPreferences(user.user_reference_id);
      const preferencesString = `"${JSON.stringify(preferences).replace(/"/g, "'")}"`;

      output += `${id},${name},${age},${gender},"${location}",${preferencesString},${behavior}\n`;
    });

    // Ensure export folder exists
    const dir = path.dirname(output_file_path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Save
    fs.writeFileSync(output_file_path, output, "utf8");
    console.log(`✅ Exported ${users.length} users → ${output_file_path}`);
  } catch (err) {
    console.error("❌ Error exporting users:", err);
  } finally {
    mongoose.disconnect();
  }
}

exportUsers();
