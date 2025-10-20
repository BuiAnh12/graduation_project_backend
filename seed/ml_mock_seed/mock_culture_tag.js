const mongoose = require('mongoose');
const { Schema } = mongoose;
require("dotenv").config();
// --- Configuration ---
// IMPORTANT: Replace this with your actual MongoDB connection string
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";

// --- Schemas and Models ---

// 1. CultureTag Model (from your prompt)
const CultureTagSchema = new Schema({
  name: { type: String, required: true },
  tag_category_id: { type: Schema.Types.ObjectId, ref: 'tag_categories' },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

CultureTagSchema.virtual('tag_categories', {
  ref: 'tag_categories',
  localField: 'tag_category_id',
  foreignField: '_id',
  justOne: true
});

const CultureTag = mongoose.model('culture_tags', CultureTagSchema);

// 2. TagCategory Model (ASSUMED)
// This minimal schema is necessary to find the ObjectId for 'culture_cat'
// We assume the model name is 'tag_categories' as referenced in your schema.
const TagCategorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String }
});

const TagCategory = mongoose.model('tag_categories', TagCategorySchema);

// --- Data ---
// The list of tag names to insert
const tagNames = [
  'Việt Nam', 'Thái Lan', 'Trung Quốc', 'Nhật Bản', 'Hàn Quốc', 'Ấn Độ',
  'Malaysia', 'Indonesia', 'Singapore', 'Philippines', 'Mỹ', 'Ý',
  'Pháp', 'Mexico'
];

// The identifier for the parent category
const categoryIdentifier = 'Cuisine';

// --- Seeder Function ---
async function seedCultureTags() {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected for seeding culture_tags...");

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
    const existingTags = await CultureTag.find({ name: { $in: tagNames } }).select('name').lean();
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
    const result = await CultureTag.insertMany(docsToInsert);
    console.log(`Successfully inserted ${result.length} new culture tags. ✅`);

  } catch (error) {
    console.error("Error seeding culture tags: ❌", error.message);
  } finally {
    // 7. Disconnect from the database
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    }
  }
}

// Run the seeder function
seedCultureTags();