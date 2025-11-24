const cron = require("node-cron");
const axios = require("axios");

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

// ----------------------------
// 1) Export data lúc 00:00
// ----------------------------
cron.schedule("0 0 * * *", async () => {
  console.log("🔁 Running export-data at 00:00");

  try {
    await axios.post(`${PYTHON_API_URL}/admin/export-data`);
    console.log("✅ Export data done");
  } catch (err) {
    console.error("❌ Export cron failed:", err.message);
  }
});

// ----------------------------
// 2) Train model lúc 00:30
// ----------------------------
cron.schedule("30 0 * * *", async () => {
  console.log("🔁 Running train-model at 00:30");

  try {
    await axios.post(`${PYTHON_API_URL}/admin/train-model`);
    console.log("✅ Train model done");
  } catch (err) {
    console.error("❌ Train cron failed:", err.message);
  }
});
