const mongoose = require('mongoose');
const { Schema } = mongoose;
require("dotenv").config();

// --- Configuration ---
// Uses the same MONGODB_URL from your .env file
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";

// --- Schemas and Models ---

// 1. FoodTag Model (from your prompt)
const FoodTagSchema = new Schema({
  name: { type: String, required: true },
  tag_category_id: { type: Schema.Types.ObjectId, ref: 'tag_categories' },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

FoodTagSchema.virtual('tag_categories', {
  ref: 'tag_categories',
  localField: 'tag_category_id',
  foreignField: '_id',
  justOne: true
});

const FoodTag = mongoose.model('food_tags', FoodTagSchema);

// 2. TagCategory Model (ASSUMED)
// This schema is necessary to find the ObjectId for 'food_cat'
const TagCategorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String }
});

const TagCategory = mongoose.model('tag_categories', TagCategorySchema);

// --- Data ---
// The list of food tag names to insert
const tagNames = [
  'thịt gà', 'thịt bò', 'thịt heo', 'cá', 'tôm', 'cua', 'đậu hũ', 'tempeh', 
  'trứng', 'vịt', 'thịt cừu', 'đậu', 'cơm', 'mì', 'bánh mì', 'mì ống', 
  'hạt diêm mạch', 'yến mạch', 'bắp', 'khoai tây', 'khoai lang', 'bột năng', 
  'cà chua', 'hành tây', 'tỏi', 'cà rốt', 'bắp cải', 'xà lách', 'rau chân vịt', 
  'cải xoăn', 'bông cải xanh', 'súp lơ', 'ớt chuông', 'nấm', 'bí ngòi', 
  'cà tím', 'đậu bắp', 'chuối', 'táo', 'xoài', 'dứa', 'cam', 'chanh vàng', 
  'chanh xanh', 'dâu tây', 'bơ', 'đu đủ', 'sữa', 'phô mai', 'sữa chua', 
  'nước cốt dừa', 'sữa hạnh nhân', 'sữa đậu nành'
];

// The identifier for the parent category (from your CSV)
const categoryIdentifier = 'Food';

// --- Seeder Function ---
async function seedFoodTags() {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected for seeding food_tags...");

    // 2. Find the parent category's ObjectId
    // We query by 'name', but you can change this to 'slug' if that's what you use
    const category = await TagCategory.findOne({ name: categoryIdentifier });

    if (!category) {
      console.error(`Error: Category "${categoryIdentifier}" not found.`);
      console.log("Please seed the 'tag_categories' collection first.");
      await mongoose.connection.close();
      return; // Stop the script
    }

    console.log(`Found category: ${category.name} (ID: ${category._id})`);

    // 3. Find which tags from our list already exist
    const existingTags = await FoodTag.find({ name: { $in: tagNames } }).select('name').lean();
    const existingTagNames = new Set(existingTags.map(tag => tag.name));
    console.log(`Found ${existingTagNames.size} existing tags in the database.`);

    // 4. Filter our list to get only the new tags
    const newTagNames = tagNames.filter(name => !existingTagNames.has(name));

    if (newTagNames.length === 0) {
      console.log("No new tags to insert. Database is already up-to-date. ✅");
      await mongoose.connection.close();
      return;
    }

    console.log(`Preparing to insert ${newTagNames.length} new tags...`);

    // 5. Prepare the new documents
    const docsToInsert = newTagNames.map(name => ({
      name: name,
      tag_category_id: category._id // Assign the ObjectId we found
    }));

    // 6. Insert the new documents
    const result = await FoodTag.insertMany(docsToInsert);
    console.log(`Successfully inserted ${result.length} new food tags. ✅`);

  } catch (error) {
    console.error("Error seeding food tags: ❌", error.message);
  } finally {
    // 7. Disconnect from the database
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    }
  }
}

// Run the seeder function
seedFoodTags();