const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// 🧩 Connect to Mongo
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected"))
  .catch(err => {
      console.error("Connection Error:", err);
      process.exit(1); 
  });

// 🧩 Register all required models
require("../../../../../models/users.model");
require("../../../../../models/stores.model");
require("../../../../../models/dishes.model");
require("../../../../../models/orders.model");
require("../../../../../models/order_items.model");
require("../../../../../models/ratings.model");

// 🧩 Load models
const Order = mongoose.model("orders");
const OrderItem = mongoose.model("order_items");
const Rating = mongoose.model("ratings");

const exportDir = path.join(__dirname, '..', 'exported_data');
const OUTPUT_PATH = path.join(exportDir, 'interaction.csv');

async function exportInteractions() {
  try {
    console.log("⏳ Fetching orders...");
    const orders = await Order.find()
      .populate("userId", "_id")
      .populate("storeId", "_id")
      .lean();

    console.log("⏳ Fetching order items...");
    const orderItems = await OrderItem.find()
      .populate("dishId", "_id name")
      .populate("orderId", "_id userId storeId createdAt status")
      .lean();

    console.log("⏳ Fetching ratings...");
    const ratings = await Rating.find().lean();

    // Map ratings by orderId + dishId for quick lookup
    const ratingMap = {};
    ratings.forEach(r => {
      const key = `${r.orderId}_${r.storeId}`;
      ratingMap[key] = r.ratingValue || "";
    });

    let csv = "interaction_id,user_id,dish_id,store_id,order_id,rating_value,quantity,final_price,status,timestamp,context\n";

    orderItems.forEach((item, index) => {
      const order = item.orderId;
      if (!order || !order.userId || !item.dishId) return;

      const user_id = order.userId.toString();
      const dish_id = item.dishId._id.toString();
      const store_id = order.storeId?.toString() || "";
      const order_id = order._id.toString();
      const rating_value = ratingMap[`${order_id}_${store_id}`] || "";
      const quantity = item.quantity || 1;
      const final_price = item.lineTotal || item.price * item.quantity || 0;
      const status = order.status || "pending";
      const timestamp = order.createdAt?.toISOString().replace("T", " ").replace("Z", "") || "";
      const context = ""; // left empty intentionally

      csv += `interaction_${index + 1},${user_id},${dish_id},${store_id},${order_id},${rating_value},${quantity},${final_price},${status},${timestamp},${context}\n`;
    });

    // Create export folder if needed
    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, csv, "utf8");

    console.log(`✅ Exported interactions → ${OUTPUT_PATH}`);
  } catch (err) {
    console.error("❌ Error exporting interactions:", err);
  } finally {
    mongoose.disconnect();
  }
}

exportInteractions();
