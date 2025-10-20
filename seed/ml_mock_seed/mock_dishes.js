const fs = require("fs").promises;
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

/**
 * Parses a CSV file content into a Map for easy lookup.
 * It creates a Map where the key is the 'name' and the value is the 'id'.
 * @param {string} filePath - The absolute path to the CSV file.
 * @returns {Promise<Map<string, string>>} A map of tag names to their IDs.
 */
async function loadTagsFromCSV(filePath) {
    try {
        const data = await fs.readFile(filePath, "utf8");
        const lines = data.trim().split("\n");
        const tagMap = new Map();

        // Skip header row (start from i = 1)
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(",");
            if (parts.length >= 2) {
                const id = parts[0].trim();
                const name = parts[1].trim();
                tagMap.set(name, id); // Key: 'thịt bò', Value: '68ed207286da2ddcd588cc89'
            }
        }
        console.log(
            `Successfully loaded ${tagMap.size} tags from ${path.basename(
                filePath
            )}`
        );
        return tagMap;
    } catch (error) {
        console.error(`Error reading or parsing file at ${filePath}:`, error);
        throw error; // Stop the script if a file is missing or corrupt
    }
}

/**
 * A helper function to get an array of Mongoose ObjectIds from an array of tag names.
 * @param {string[]} nameArray - An array of tag names (e.g., ['thịt bò', 'cơm']).
 * @param {Map<string, string>} tagMap - The map containing name-to-id mappings.
 * @returns {mongoose.Types.ObjectId[]} An array of ObjectIds.
 */
const getIdsFromNames = (nameArray, tagMap) => {
    const ids = [];
    for (const name of nameArray) {
        if (tagMap.has(name)) {
            ids.push(new mongoose.Types.ObjectId(tagMap.get(name)));
        } else {
            console.warn(
                `--> Warning: Tag "${name}" not found in the provided map.`
            );
        }
    }
    return ids;
};

/**
 * Main function to generate and seed dish data into the database.
 */
async function seedDatabase() {
    // --- 1. DEFINE FILE PATHS ---
    // Uses path.join to create correct paths regardless of OS
    const basePath = path.join(__dirname, "../../exported_data");
    const cookingMethodPath = path.join(
        basePath,
        "cooking_method_tags.csv"
    );
    const culturePath = path.join(basePath, "culture_tags.csv");
    const foodPath = path.join(basePath, "food_tags.csv");
    const tastePath = path.join(basePath, "taste_tags.csv");

    // --- 2. LOAD ALL TAGS FROM FILES CONCURRENTLY ---
    const [cookingMethodTags, cultureTags, foodTags, tasteTags] =
        await Promise.all([
            loadTagsFromCSV(cookingMethodPath),
            loadTagsFromCSV(culturePath),
            loadTagsFromCSV(foodPath),
            loadTagsFromCSV(tastePath),
        ]);

    // --- 3. DISH DEFINITIONS ---
    const storeVietnameseId = new mongoose.Types.ObjectId(
        "68f30cbea2bca94aa9fd19c7"
    );
    const storeAsianFusionId = new mongoose.Types.ObjectId(
        "68f30cbfa2bca94aa9fd19c8"
    );

    const dishesToSeed = [
        // == Vietnamese Dishes ==
        {
            name: "Phở Bò",
            price: 65000,
            storeId: storeVietnameseId,
            description:
                "Phở bò truyền thống với nước dùng đậm đà, bánh phở mềm và thịt bò thái mỏng.",
            dishTags: getIdsFromNames(
                ["thịt bò", "mì", "hành tây", "gừng", "hoa hồi", "quế", "ngò"],
                foodTags
            ),
            tasteTags: getIdsFromNames(
                ["đậm đà", "vừa muối", "thơm gia vị"],
                tasteTags
            ),
            cookingMethodtags: getIdsFromNames(
                ["hầm", "luộc"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },
        {
            name: "Bánh Mì Thịt Nướng",
            price: 35000,
            storeId: storeVietnameseId,
            description:
                "Bánh mì giòn rụm kẹp thịt heo nướng thơm lừng, cùng đồ chua và rau thơm.",
            dishTags: getIdsFromNames(
                ["bánh mì", "thịt heo", "cà rốt", "ngò", "nước mắm"],
                foodTags
            ),
            tasteTags: getIdsFromNames(["ngọt vừa", "đậm đà"], tasteTags),
            cookingMethodtags: getIdsFromNames(
                ["nướng", "ướp"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },
        {
            name: "Gỏi Cuốn Tôm",
            price: 45000,
            storeId: storeVietnameseId,
            description:
                "Gỏi cuốn thanh mát với tôm, thịt luộc, bún và rau sống, chấm cùng tương đậu phộng.",
            dishTags: getIdsFromNames(
                ["tôm", "thịt heo", "xà lách", "sốt đậu phộng"],
                foodTags
            ),
            tasteTags: getIdsFromNames(["nhẹ", "không cay"], tasteTags),
            cookingMethodtags: getIdsFromNames(
                ["sống", "luộc"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },
        {
            name: "Cơm Tấm Sườn Nướng",
            price: 55000,
            storeId: storeVietnameseId,
            description:
                "Dĩa cơm tấm nóng hổi với sườn cốt lết nướng mật ong, bì, chả và nước mắm chua ngọt.",
            dishTags: getIdsFromNames(
                ["cơm", "thịt heo", "trứng", "nước mắm"],
                foodTags
            ),
            tasteTags: getIdsFromNames(["ngọt vừa", "đậm đà"], tasteTags),
            cookingMethodtags: getIdsFromNames(["nướng"], cookingMethodTags),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },
        {
            name: "Chả Cá Lã Vọng",
            price: 75000,
            storeId: storeVietnameseId,
            description:
                "Đặc sản Hà Nội với cá lăng ướp nghệ, riềng, nướng trên than và ăn kèm bún, mắm tôm.",
            dishTags: getIdsFromNames(
                ["cá", "nghệ", "gừng", "hành tây", "đậu phộng"],
                foodTags
            ),
            tasteTags: getIdsFromNames(["đậm đà", "thơm thảo mộc"], tasteTags),
            cookingMethodtags: getIdsFromNames(
                ["rán chảo", "ướp"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },
        {
            name: "Bún Chả Hà Nội",
            price: 60000,
            storeId: storeVietnameseId,
            description:
                "Bún tươi ăn cùng chả viên và chả miếng nướng than hoa, trong bát nước chấm chua ngọt.",
            dishTags: getIdsFromNames(
                ["mì", "thịt heo", "nước mắm", "đu đủ"],
                foodTags
            ),
            tasteTags: getIdsFromNames(
                ["ngọt vừa", "chua", "đậm đà"],
                tasteTags
            ),
            cookingMethodtags: getIdsFromNames(
                ["nướng", "ướp"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },
        {
            name: "Bánh Xèo Miền Tây",
            price: 50000,
            storeId: storeVietnameseId,
            description:
                "Bánh xèo vỏ giòn rụm, nhân tôm, thịt, giá đỗ, ăn kèm rau sống và nước mắm chua ngọt.",
            dishTags: getIdsFromNames(
                ["bột năng", "tôm", "thịt heo", "nước cốt dừa"],
                foodTags
            ),
            tasteTags: getIdsFromNames(["béo nhẹ", "đậm đà"], tasteTags),
            cookingMethodtags: getIdsFromNames(
                ["chiên ngập dầu"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },
        {
            name: "Canh Chua Cá Lóc",
            price: 70000,
            storeId: storeVietnameseId,
            description:
                "Món canh dân dã miền Nam với vị chua thanh của me, ngọt của dứa và thịt cá lóc tươi.",
            dishTags: getIdsFromNames(["cá", "cà chua", "dứa", "ớt"], foodTags),
            tasteTags: getIdsFromNames(
                ["chua", "ngọt vừa", "cay nhẹ"],
                tasteTags
            ),
            cookingMethodtags: getIdsFromNames(
                ["nấu nhỏ lửa"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },
        {
            name: "Nem Nướng Nha Trang",
            price: 65000,
            storeId: storeVietnameseId,
            description:
                "Nem nướng thơm lừng cuộn cùng bánh tráng, rau sống và chấm với sốt tương đặc biệt.",
            dishTags: getIdsFromNames(["thịt heo", "sốt đậu phộng"], foodTags),
            tasteTags: getIdsFromNames(["ngọt vừa", "đậm đà"], tasteTags),
            cookingMethodtags: getIdsFromNames(["nướng"], cookingMethodTags),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },
        {
            name: "Chè Đậu Đỏ",
            price: 25000,
            storeId: storeVietnameseId,
            description:
                "Món tráng miệng ngọt ngào với đậu đỏ hầm mềm, nước cốt dừa béo ngậy.",
            dishTags: getIdsFromNames(
                ["đậu", "đường", "nước cốt dừa"],
                foodTags
            ),
            tasteTags: getIdsFromNames(["ngọt nhiều", "béo nhẹ"], tasteTags),
            cookingMethodtags: getIdsFromNames(
                ["hầm", "nấu nhỏ lửa"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Việt Nam"], cultureTags),
        },

        // == Asian Fusion Dishes ==
        {
            name: "Ramen Tonkotsu",
            price: 85000,
            storeId: storeAsianFusionId,
            description:
                "Ramen nước hầm xương heo béo ngậy, topping thịt xá xíu, trứng lòng đào và măng.",
            dishTags: getIdsFromNames(
                ["thịt heo", "mì", "trứng", "nấm"],
                foodTags
            ),
            tasteTags: getIdsFromNames(
                ["đậm đà", "béo ngậy", "vừa muối"],
                tasteTags
            ),
            cookingMethodtags: getIdsFromNames(
                ["hầm", "luộc"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Nhật Bản"], cultureTags),
        },
        {
            name: "Pad Thai Fusion",
            price: 70000,
            storeId: storeAsianFusionId,
            description:
                "Pad Thái xào với đậu hũ, giá, hẹ và sốt me chua ngọt, rắc đậu phộng rang.",
            dishTags: getIdsFromNames(
                ["đậu hũ", "mì", "đậu phộng", "chanh xanh"],
                foodTags
            ),
            tasteTags: getIdsFromNames(
                ["chua", "ngọt vừa", "đậm đà"],
                tasteTags
            ),
            cookingMethodtags: getIdsFromNames(["xào"], cookingMethodTags),
            cultureTags: getIdsFromNames(["Thái Lan"], cultureTags),
        },
        {
            name: "Korean BBQ Bulgogi",
            price: 95000,
            storeId: storeAsianFusionId,
            description:
                "Thịt bò thái mỏng ướp sốt tương ngọt, nướng trên vỉ nóng ăn kèm kim chi và cơm.",
            dishTags: getIdsFromNames(
                ["thịt bò", "nước tương", "đường", "hành tây", "cơm"],
                foodTags
            ),
            tasteTags: getIdsFromNames(["ngọt nhiều", "đậm đà"], tasteTags),
            cookingMethodtags: getIdsFromNames(
                ["nướng", "ướp"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Hàn Quốc"], cultureTags),
        },
        {
            name: "Kung Pao Chicken",
            price: 75000,
            storeId: storeAsianFusionId,
            description:
                "Gà xào cay Tứ Xuyên với ớt khô, đậu phộng và sốt chua ngọt đặc trưng.",
            dishTags: getIdsFromNames(["thịt gà", "ớt", "đậu phộng"], foodTags),
            tasteTags: getIdsFromNames(
                ["cay vừa", "ngọt vừa", "chua"],
                tasteTags
            ),
            cookingMethodtags: getIdsFromNames(["xào"], cookingMethodTags),
            cultureTags: getIdsFromNames(["Trung Quốc"], cultureTags),
        },
        {
            name: "Butter Chicken Curry",
            price: 80000,
            storeId: storeAsianFusionId,
            description:
                "Cà ri gà Ấn Độ nấu với sốt cà chua, bơ và kem, ăn cùng cơm Basmati.",
            dishTags: getIdsFromNames(
                ["thịt gà", "bơ", "kem", "cà chua", "bột cà ri", "cơm"],
                foodTags
            ),
            tasteTags: getIdsFromNames(
                ["béo ngậy", "đậm đà", "thơm gia vị", "cay nhẹ"],
                tasteTags
            ),
            cookingMethodtags: getIdsFromNames(
                ["om", "nấu nhỏ lửa"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Ấn Độ"], cultureTags),
        },
        {
            name: "Sushi Salmon Roll",
            price: 90000,
            storeId: storeAsianFusionId,
            description: "Cơm cuộn rong biển với cá hồi tươi, bơ và dưa leo.",
            dishTags: getIdsFromNames(["cá", "cơm", "bơ"], foodTags),
            tasteTags: getIdsFromNames(["nhẹ", "béo nhẹ"], tasteTags),
            cookingMethodtags: getIdsFromNames(["sống"], cookingMethodTags),
            cultureTags: getIdsFromNames(["Nhật Bản"], cultureTags),
        },
        {
            name: "Tom Yum Goong",
            price: 65000,
            storeId: storeAsianFusionId,
            description:
                "Canh chua cay Thái Lan với tôm, nấm, sả, lá chanh và riềng.",
            dishTags: getIdsFromNames(
                ["tôm", "sả", "nấm", "chanh xanh", "ớt"],
                foodTags
            ),
            tasteTags: getIdsFromNames(
                ["cay vừa", "chua", "thơm thảo mộc"],
                tasteTags
            ),
            cookingMethodtags: getIdsFromNames(
                ["nấu nhỏ lửa"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Thái Lan"], cultureTags),
        },
        {
            name: "Bibimbap Bowl",
            price: 75000,
            storeId: storeAsianFusionId,
            description:
                "Cơm trộn Hàn Quốc với thịt bò xào, các loại rau và trứng ốp la, ăn cùng sốt ớt.",
            dishTags: getIdsFromNames(
                [
                    "cơm",
                    "thịt bò",
                    "trứng",
                    "rau chân vịt",
                    "cà rốt",
                    "tương ớt",
                ],
                foodTags
            ),
            tasteTags: getIdsFromNames(["cay nhẹ", "đậm đà"], tasteTags),
            cookingMethodtags: getIdsFromNames(
                ["xào", "luộc"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Hàn Quốc"], cultureTags),
        },
        {
            name: "Mapo Tofu",
            price: 60000,
            storeId: storeAsianFusionId,
            description:
                "Đậu hũ non sốt cay Tứ Xuyên với thịt heo bằm, đậu tương lên men và tiêu.",
            dishTags: getIdsFromNames(
                ["đậu hũ", "thịt heo", "ớt", "tương hột"],
                foodTags
            ),
            tasteTags: getIdsFromNames(
                ["cay nhiều", "đậm đà", "béo nhẹ", "vị lên men"],
                tasteTags
            ),
            cookingMethodtags: getIdsFromNames(
                ["om", "nấu nhỏ lửa"],
                cookingMethodTags
            ),
            cultureTags: getIdsFromNames(["Trung Quốc"], cultureTags),
        },
        {
            name: "Mango Sticky Rice",
            price: 40000,
            storeId: storeAsianFusionId,
            description:
                "Xôi nếp dẻo ăn cùng xoài chín ngọt và nước cốt dừa béo ngậy.",
            dishTags: getIdsFromNames(
                ["xoài", "cơm", "nước cốt dừa", "đường"],
                foodTags
            ),
            tasteTags: getIdsFromNames(["ngọt nhiều", "béo ngậy"], tasteTags),
            cookingMethodtags: getIdsFromNames(["hấp"], cookingMethodTags),
            cultureTags: getIdsFromNames(["Thái Lan"], cultureTags),
        },
    ];

    const Dish = require("../../models/dishes.model");

    try {
        // Connect to your MongoDB database
        const MONGO_URI =
            process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
        mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log("\nDatabase connected successfully.");
        console.log(dishesToSeed)
        const dishName = dishesToSeed.map((s) => s.name);
        // Clear existing dishes to ensure a clean seed, making the script rerunnable
        // await Dish.deleteMany({ name: { $in: dishName } });
        await Dish.deleteMany({});
        console.log("Old dishes cleared.");

        // Insert the new seed data
        await Dish.insertMany(dishesToSeed);
        console.log(`✅ Successfully seeded ${dishesToSeed.length} dishes!`);
    } catch (error) {
        console.error("❌ Error seeding database:", error);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log("Database connection closed.");
    }
}

seedDatabase()