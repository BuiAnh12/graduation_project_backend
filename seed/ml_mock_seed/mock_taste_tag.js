const mongoose = require('mongoose');
const { Schema } = mongoose;
require("dotenv").config();

// --- Configuration ---
// Uses the same MONGODB_URL from your .env file
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";


const TasteTag = require("../../models/taste_tags.model")
// 2. TagCategory Model (ASSUMED)
// This schema is necessary to find the ObjectId for 'taste_cat'
const TagCategorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String }
});

const TagCategory = mongoose.model('tag_categories', TagCategorySchema);

// --- Data ---
// The list of tag data to insert
const tagsData = [
  { name: 'Không Cay', kind: 'Cay', level: 0 },
  { name: 'Hơi Cay', kind: 'Cay', level: 1 },
  { name: 'Cay vừa', kind: 'Cay', level: 2 },
  { name: 'Cay', kind: 'Cay', level: 3 },
  { name: 'Rất Cay', kind: 'Cay', level: 4 },
  { name: 'Không ớt', kind: 'Cay', level: 0 },
  { name: 'Không Ngọt', kind: 'Ngọt', level: 0 },
  { name: 'Ít Ngọt', kind: 'Ngọt', level: 1 },
  { name: 'Ngọt vừa', kind: 'Ngọt', level: 2 },
  { name: 'Ngọt', kind: 'Ngọt', level: 3 },
  { name: 'Không đường', kind: 'Ngọt', level: 0 },
  { name: 'Ít đường', kind: 'Ngọt', level: 1 },
  { name: 'Không chua', kind: 'Chua', level: 0 },
  { name: 'Chua nhẹ', kind: 'Chua', level: 1 },
  { name: 'Chua', kind: 'Chua', level: 2 },
  { name: 'Chua cam quýt', kind: 'Chua', level: 3 },
  { name: 'Không muối', kind: 'Mặn', level: 0 },
  { name: 'Ít muối', kind: 'Mặn', level: 1 },
  { name: 'Muối bình thường', kind: 'Mặn', level: 2 },
  { name: 'Mặn', kind: 'Mặn', level: 3 },
  { name: 'Ít đậm đà', kind: 'Đậm đà', level: 1 },
  { name: 'Đậm đà', kind: 'Đậm đà', level: 2 },
  { name: 'Vị lên men', kind: 'Đậm đà', level: 3 },
  { name: 'Đắng', kind: 'Đắng', level: 1 },
  { name: 'Không đắng', kind: 'Đắng', level: 0 },
  { name: 'Nhẹ', kind: 'Béo', level: 1 },
  { name: 'Béo ngậy', kind: 'Béo', level: 2 },
  { name: 'Đậm đà', kind: 'Béo', level: 3 },
  { name: 'Không sữa', kind: 'Béo', level: 0 },
  { name: 'Vị trung tính', kind: 'Hương thơm', level: 0 },
  { name: 'Thảo mộc', kind: 'Hương thơm', level: 1 },
  { name: 'Gia vị', kind: 'Hương thơm', level: 2 },
  { name: 'Thơm', kind: 'Hương thơm', level: 3 }
];


// The identifier for the parent category (from your CSV)
const categoryIdentifier = 'Taste';

// --- Seeder Function ---
async function seedTasteTags() {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected for seeding taste_tags...");

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

    // 3. Find which tags from our list already exist (checking by 'name')
    const tagNames = tagsData.map(t => t.name);
    const existingTags = await TasteTag.find({ name: { $in: tagNames } }).select('name').lean();
    const existingTagNames = new Set(existingTags.map(tag => tag.name));
    console.log(`Found ${existingTagNames.size} existing tags in the database.`);

    // 4. Filter our list to get only the new tags
    const newTagsData = tagsData.filter(tag => !existingTagNames.has(tag.name));

    if (newTagsData.length === 0) {
      console.log("No new taste tags to insert. Database is already up-to-date. ✅");
      await mongoose.connection.close();
      return;
    }

    console.log(`Preparing to insert ${newTagsData.length} new taste tags...`);

    // 5. Prepare the new documents, including the tag_category_id
    const docsToInsert = newTagsData.map(tag => ({
      name: tag.name,
      kind: tag.kind,
      level: tag.level,
      tag_category_id: category._id // Assign the ObjectId we found
    }));

    // 6. Insert the new documents
    const result = await TasteTag.insertMany(docsToInsert);
    console.log(`Successfully inserted ${result.length} new taste tags. ✅`);

  } catch (error) {
    console.error("Error seeding taste tags: ❌", error.message);
  } finally {
    // 7. Disconnect from the database
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    }
  }
}

// Run the seeder function
seedTasteTags();