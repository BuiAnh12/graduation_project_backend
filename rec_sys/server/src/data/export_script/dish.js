const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected"))
  .catch(err => {
      console.error("Connection Error:", err);
      process.exit(1); 
  });

// Import models
const Dish = require("../../../../../models/dishes.model");
require("../../../../../models/categories.model");
require("../../../../../models/stores.model");
require("../../../../../models/food_tags.model");
require("../../../../../models/taste_tags.model");
require("../../../../../models/cooking_method_tags.model");
require("../../../../../models/culture_tags.model");

// Đường dẫn file output
const exportDir = path.join(__dirname, '..', 'exported_data');
const output_file_path = path.join(exportDir, 'dishes.csv');

function formatCsvField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    let str = String(field);
    str = str.replace(/(\r\n|\n|\r)/gm, ' '); // Xóa ký tự xuống dòng
    if (str.includes(',') || str.includes('"')) {
        str = str.replace(/"/g, '""'); // Escape dấu ngoặc kép
        return `"${str}"`;
    }
    return str;
}

function formatTagsAsPythonList(tags) {
    if (!tags || tags.length === 0) {
        return "[]";
    }
    // 1. Lấy _id, 2. Bọc mỗi _id bằng dấu ngoặc đơn, 3. Nối chúng lại
    const innerContent = tags.map(tag => `'${tag._id}'`).join(', ');
    return `[${innerContent}]`;
}



// Logic export chính
async function exportDishes() {
    try {
        const dishes = await Dish.find()
            .populate("category", "name")
            .populate("storeId", "name")
            .populate("dishTags", "name")
            .populate("tasteTags", "name")
            .populate("cookingMethodtags", "name")
            .populate("cultureTags", "name")
            .lean();

        const header = "id,name,description,price,category,store_id,stock_status,stock_count,rating,created_at,updated_at,food_tags,taste_tags,cooking_method_tags,culture_tags\n";
        
        const rows = dishes.map((dish) => {
            // Sử dụng các hàm hỗ trợ để định dạng từng trường
            const row = [
                dish._id,
                formatCsvField(dish.name),
                formatCsvField(dish.description),
                dish.price || 0,
                formatCsvField(dish.category?.name),
                dish.storeId?._id,
                dish.stockStatus || "available",
                dish.stockCount ?? "",
                (3.5 + Math.random() * 1.5).toFixed(1),
                dish.createdAt?.toISOString().replace("T", " ").substring(0, 19) || "",
                dish.updatedAt?.toISOString().replace("T", " ").substring(0, 19) || "",
                // **SỬA LỖI QUAN TRỌNG:** Dùng hàm mới để định dạng tag
                formatCsvField(formatTagsAsPythonList(dish.dishTags)),
                formatCsvField(formatTagsAsPythonList(dish.tasteTags)),
                formatCsvField(formatTagsAsPythonList(dish.cookingMethodtags)),
                formatCsvField(formatTagsAsPythonList(dish.cultureTags))
            ];
            return row.join(',');
        });

        const output = header + rows.join('\n');

        // Đảm bảo thư mục export tồn tại
        const dir = path.dirname(output_file_path);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(output_file_path, output, "utf8");
        console.log(`✅ Exported ${dishes.length} dishes → ${output_file_path}`);

    } catch (err) {
        console.error("❌ Error exporting dishes:", err);
    } finally {
        mongoose.disconnect();
    }
}

exportDishes();