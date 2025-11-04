const cron = require("node-cron");
const mongoose = require("mongoose");
const Shipper = require("../models/shippers.model");

// ⚙️ Nếu file này chạy độc lập, kết nối DB trước
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

// 🕒 Tạo cron job chạy mỗi phút
cron.schedule("*/1 * * * *", async () => {
  console.log("[CRON] Checking inactive shippers...");

  const now = new Date();
  const cutoff = new Date(now.getTime() - 60 * 1000); // 1 phút trước

  try {
    const result = await Shipper.updateMany(
      {
        online: true,
        $or: [
          { "currentLocation.updatedAt": { $exists: false } },
          { "currentLocation.updatedAt": { $lt: cutoff } },
        ],
      },
      { $set: { online: false } }
    );

    console.log(
      `[CRON] Updated ${result.modifiedCount} shippers to offline (no heartbeat)`
    );
  } catch (error) {
    console.error("[CRON ERROR]", error);
  }
});
