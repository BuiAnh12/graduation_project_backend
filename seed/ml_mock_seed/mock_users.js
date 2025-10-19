const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";

// --- Schemas & Models ---

// User Model
const User = require("../../models/users.model")

// UserReference Model
const UserReference = require("../../models/user_references.model")


// --- User & Persona Data ---

// Original user data from your CSV
const usersData = [
    { _id: "68ea026c04589194166b9e48", name: "Health Conscious", age: 24, gender: "Female" },
    { _id: "68ea026c04589194166b9e4d", name: "Adventure Seeker", age: 25, gender: "Male" },
    { _id: "68ea026d04589194166b9e52", name: "Comfort Food Lover", age: 26, gender: "Female" },
    { _id: "68ea026d04589194166b9e57", name: "Traditional Eater", age: 27, gender: "Male" },
    { _id: "68ea026d04589194166b9e5c", name: "Trendy Foodie", age: 28, gender: "Female" },
    { _id: "68ea026e04589194166b9e61", name: "Spice Lover", age: 29, gender: "Male" },
    { _id: "68ea026e04589194166b9e66", name: "Quick Eater", age: 30, gender: "Female" },
    { _id: "68ea026e04589194166b9e6b", name: "Balanced Eater", age: 21, gender: "Male" },
    { _id: "68ea026e04589194166b9e70", name: "Conservative Eater", age: 22, gender: "Female" },
    { _id: "68ea026f04589194166b9e75", name: "Sweet Tooth", age: 23, gender: "Male" },
];

// Detailed persona preferences translated into tags
const personas = [
    { name: "Health Conscious", like_culture: ['Việt Nam', 'Nhật Bản'], like_taste: ['Ít đậm đà', 'Đậm đà'], dislike_taste: ['Cay nhẹ', 'cay nhiều'], dislike_cooking_method: ['chiên ngập dầu'], like_cooking_method: ['hấp', 'luộc'], like_food: ['cá', 'tôm', 'đậu hũ', 'rau chân vịt', 'bông cải xanh', 'hạt diêm mạch', 'yến mạch', 'thịt gà'], dislike_food: ['mỡ heo', 'tương ớt', 'ớt', 'đường'] },
    { name: "Adventure Seeker", like_culture: ['Thái Lan', 'Hàn Quốc'], like_taste: ['Cay nhiều', 'Cay nhẹ', 'vị chua từ cam chanh'], dislike_taste: ['Không cay'], like_food: ['ớt', 'sả', 'gừng', 'tôm', 'mì', 'bột cà ri', 'tương ớt'], dislike_food: ['xà lách'] },
    { name: "Comfort Food Lover", like_culture: ['Trung Quốc', 'Việt Nam'], like_taste: ['Cay vừa', 'Ngọt vừa'], like_cooking_method: ['hầm', 'om'], dislike_taste: ['Cay nhiều', 'Không ngọt'], like_food: ['thịt heo', 'thịt bò', 'khoai tây', 'cà rốt', 'mì', 'cơm', 'nấm'], dislike_food: ['ớt', 'gừng'] },
    { name: "Traditional Eater", like_culture: ['Việt Nam'], dislike_culture: ['Thái Lan', 'Trung Quốc', 'Nhật Bản', 'Hàn Quốc', 'Mỹ', 'Ý'], dislike_taste: ['Cay nhẹ', 'Cay vừa', 'Cay nhiều', 'Ngọt vừa'], like_taste: ['Không cay'], like_food: ['nước mắm', 'thịt heo', 'cá', 'cơm', 'thịt gà'], dislike_food: ['phô mai', 'mì ống', 'ớt', 'bột cà ri', 'bơ', 'sốt mayonnaise'] },
    { name: "Trendy Foodie", like_culture: ['Nhật Bản', 'Hàn Quốc'], like_taste: ['Đậm đà', 'Cay nhẹ'], dislike_taste: ['Cay nhiều'], like_food: ['cá', 'mì', 'nấm', 'đậu hũ', 'nước tương', 'hạt mè'], dislike_food: ['mỡ heo'] },
    { name: "Spice Lover", like_culture: ['Ấn Độ', 'Thái Lan'], like_taste: ['Cay nhiều', 'Cay nhẹ', 'Thơm gia vị'], dislike_taste: ['Không cay'], like_food: ['ớt', 'bột cà ri', 'gừng', 'nghệ', 'sả', 'quế', 'hoa hồi'], dislike_food: [] },
    { name: "Quick Eater", like_culture: ['Việt Nam', 'Trung Quốc'], like_cooking_method: ['xào', 'rán chảo'], dislike_cooking_method: ['hầm', 'om', 'nướng lò'], like_taste: ['Cay vừa', 'Ngọt vừa'], like_food: ['mì', 'cơm', 'thịt bò', 'hành tây', 'tỏi', 'trứng'], dislike_food: [] },
    { name: "Balanced Eater", like_culture: ['Hàn Quốc', 'Nhật Bản'], like_taste: ['Cay vừa', 'hơi chua'], dislike_taste: ['Cay nhiều', 'vị chua từ cam chanh'], like_food: ['đậu hũ', 'cá', 'cơm', 'giấm', 'cải xoăn', 'bông cải xanh'], dislike_food: ['ớt', 'chanh vàng', 'chanh xanh', 'mỡ heo'] },
    { name: "Conservative Eater", like_culture: ['Việt Nam'], dislike_culture: ['Thái Lan', 'Trung Quốc', 'Nhật Bản', 'Hàn Quốc', 'Mỹ', 'Ý'], dislike_taste: ['Cay nhẹ', 'Cay vừa', 'Cay nhiều', 'Ngọt vừa'], like_taste: ['Không cay'], like_food: ['nước mắm', 'thịt heo', 'cá', 'cơm', 'thịt gà'], dislike_food: ['phô mai', 'mì ống', 'ớt', 'bột cà ri', 'bơ', 'sốt mayonnaise'] },
    { name: "Sweet Tooth", like_culture: ['Thái Lan', 'Việt Nam'], like_taste: ['Ngọt vừa', 'Cay vừa'], dislike_taste: ['Không ngọt', 'Không cay'], like_food: ['xoài', 'nước cốt dừa', 'đường', 'mật ong', 'khoai lang', 'chuối'], dislike_food: [] },];

// --- Helper Functions ---

/**
 * Parses a CSV file content into a Map for easy lookup.
 */
async function loadTagsFromCSV(filePath) {
    try {
        const data = await fs.readFile(filePath, "utf8");
        const lines = data.trim().split("\n");
        const tagMap = new Map();
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(",");
            if (parts.length >= 2) {
                const id = parts[0].trim();
                const name = parts[1].trim();
                tagMap.set(name, id);
            }
        }
        console.log(`✅ Loaded ${tagMap.size} tags from ${path.basename(filePath)}`);
        return tagMap;
    } catch (error) {
        console.error(`❌ Error reading file at ${filePath}:`, error);
        throw error;
    }
}

/**
 * A helper function to get an array of Mongoose ObjectIds from an array of tag names.
 */
const getIdsFromNames = (nameArray = [], tagMap) => {
    const ids = [];

    // For efficient case-insensitive lookup, we create a new map where keys are
    // lowercased. The value stores both the original ID and the original tag name
    // for more informative logging.
    const lowerCaseTagMap = new Map();
    for (const [originalName, id] of tagMap.entries()) {
        lowerCaseTagMap.set(originalName.toLowerCase(), { id, originalName });
    }

    // Iterate through the names provided by the user.
    for (const name of nameArray) {
        const lowerCaseName = name.toLowerCase(); // Convert the input name to lowercase.

        // Check if the lowercased name exists in our lowercased map.
        if (lowerCaseTagMap.has(lowerCaseName)) {
            const match = lowerCaseTagMap.get(lowerCaseName);
            // If it exists, add the corresponding ObjectId to our results array.
            ids.push(new mongoose.Types.ObjectId(match.id));
            // Log the successful match to show which original tag it mapped to.
            console.log(`--> ✅ Match found: Input "${name}" matched with tag "${match.originalName}".`);
        } else {
            // If no match is found, log a warning.
            console.warn(`--> ⚠️ Warning: Tag "${name}" not found in the provided map.`);
        }
    }
    return ids;
};

// --- Main Seeder Script ---

async function seedDatabase() {
    try {
        // 1. Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log("🚀 MongoDB connected for seeding users...");

        // 2. Load all tag data from CSV files
        const basePath = path.join(__dirname, "../../exported_data"); // Adjust this path if needed
        const [cultureTags, foodTags, tasteTags, cookingMethodTags] = await Promise.all([
            loadTagsFromCSV(path.join(basePath, "culture_tags.csv")),
            loadTagsFromCSV(path.join(basePath, "food_tags.csv")),
            loadTagsFromCSV(path.join(basePath, "taste_tags.csv")),
            loadTagsFromCSV(path.join(basePath, "cooking_method_tags.csv")),
        ]);

        console.log("\n🔄 Starting user and preferences creation...");
        
        // 3. Loop through users and create corresponding preferences
        for (const userData of usersData) {
            const persona = personas.find(p => p.name === userData.name);
            if (!persona) {
                console.warn(`--> ⚠️ No persona found for user: ${userData.name}`);
                continue;
            }

            // Create UserReference document
            const referenceDoc = new UserReference({
                like_food: getIdsFromNames(persona.like_food, foodTags),
                like_culture: getIdsFromNames(persona.like_culture, cultureTags),
                like_taste: getIdsFromNames(persona.like_taste, tasteTags),
                like_cooking_method: getIdsFromNames(persona.like_cooking_method, cookingMethodTags),
                dislike_food: getIdsFromNames(persona.dislike_food, foodTags),
                dislike_culture: getIdsFromNames(persona.dislike_culture, cultureTags),
                dislike_taste: getIdsFromNames(persona.dislike_taste, tasteTags),
                dislike_cooking_method: getIdsFromNames(persona.dislike_cooking_method, cookingMethodTags),
            });
            await referenceDoc.save();

            // Create or update User document
            const userEmail = `${userData.name.replace(/\s+/g, '.').toLowerCase()}@example.com`;
            const result = await User.findOneAndUpdate(
                { _id: new mongoose.Types.ObjectId(userData._id) },
                {
                    _id: new mongoose.Types.ObjectId(userData._id),
                    name: userData.name,
                    gender: userData.gender,
                    email: userEmail,
                    user_reference_id: referenceDoc._id,
                },
                { upsert: true, new: true } // Upsert: create if doesn't exist
            );
            console.log(`   - Created/Updated user: ${result.name}`);
        }
        
        console.log("\n🎉 Successfully seeded all users and their preferences!");

    } catch (error) {
        console.error("❌ A fatal error occurred during the seeding process:", error);
    } finally {
        // 4. Disconnect from the database
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log("\n🔌 MongoDB connection closed.");
        }
    }
}

// Run the seeder function
seedDatabase();