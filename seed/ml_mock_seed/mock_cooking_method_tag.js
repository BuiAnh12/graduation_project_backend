const mongoose = require('mongoose');
const { Schema } = mongoose;
require("dotenv").config();

// --- Configuration ---
// Uses the same MONGODB_URL from your .env file
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";

// --- Schemas and Models ---

// 1. CookingMethodTag Model (from your prompt)
const CookingMethodTagSchema = new Schema({
  name: { type: String, required: true },
  tag_category_id: { type: Schema.Types.ObjectId, ref: 'tag_categories' },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

CookingMethodTagSchema.virtual('tag_categories', {
  ref: 'tag_categories',
  localField: 'tag_category_id',
  foreignField: '_id',
  justOne: true
});

const CookingMethodTag = mongoose.model('cooking_method_tags', CookingMethodTagSchema);

// 2. TagCategory Model (ASSUMED)
// This schema is necessary to find the ObjectId for 'cooking_cat'
const TagCategorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String }
});

const TagCategory = mongoose.model('tag_categories', TagCategorySchema);

// --- Data ---
// The list of cooking method tag names to insert
const tagNames = [
  'sống', 'ướp', 'luộc', 'nấu nhỏ lửa', 'hấp', 'chần', 'trụng', 'xào', 
  'rán chảo', 'chiên ngập dầu', 'nướng', 'quay', 'nướng lò', 'om', 'hầm', 
  'hun khói', 'áp chảo'
];

// The identifier for the parent category (from your CSV)
const categoryIdentifier = 'Cooking Method';

// --- Seeder Function ---
async function seedCookingMethodTags() {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected for seeding cooking_method_tags...");

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
    const existingTags = await CookingMethodTag.find({ name: { $in: tagNames } }).select('name').lean();
    const existingTagNames = new Set(existingTags.map(tag => tag.name));
    console.log(`Found ${existingTagNames.size} existing tags in the database.`);

    // 4. Filter our list to get only the new tags
    const newTagNames = tagNames.filter(name => !existingTagNames.has(name));

    if (newTagNames.length === 0) {
      console.log("No new cooking method tags to insert. Database is already up-to-date. ✅");
      await mongoose.connection.close();
      return;
    }

    console.log(`Preparing to insert ${newTagNames.length} new cooking method tags...`);

    // 5. Prepare the new documents
    const docsToInsert = newTagNames.map(name => ({
      name: name,
      tag_category_id: category._id // Assign the ObjectId we found
    }));

    // 6. Insert the new documents
    const result = await CookingMethodTag.insertMany(docsToInsert);
    console.log(`Successfully inserted ${result.length} new cooking method tags. ✅`);

  } catch (error) {
    console.error("Error seeding cooking method tags: ❌", error.message);
  } finally {
    // 7. Disconnect from the database
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    }
  }
}

// Run the seeder function
seedCookingMethodTags();