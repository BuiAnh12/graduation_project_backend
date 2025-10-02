require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db_connection");
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

// Route import
const authRoute = require("./routes/auth.route");
const cartRoute = require("./routes/cart.route");
const adminRoute = require("./routes/admin.routes");
const authAdminRoute = require("./routes/auth.admin.routes");
const voucherRoute = require("./routes/voucher.routes");
const staffRoute = require("./routes/staff.routes");
const uploadRoute = require("./routes/upload.routes");
const userRoute = require("./routes/user.route")
const favoriteRoute = require("./routes/favorite.routes")
const orderRoute = require("./routes/order.route")
const paymentRoute = require("./routes/order.route")
const storeRoute = require("./routes/store.route")
const ratingRoute = require("./routes/rating.routes")
const app = express();
connectDB();

app.use(morgan("dev"));
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://192.168.1.10:300",
    ],
    credentials: true,
  })
);

// Middleware to parse JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

PORT = process.env.PORT || 5000;

// Basic route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// Route
app.use("/api/v1/auth", authRoute);

// Cart
app.use("/api/v1/cart", cartRoute);

// Order
app.use("/api/v1/order", orderRoute)

// Payment
app.use("/api/v1/payment", paymentRoute)

// Favorite
app.use("/api/v1/favorite", favoriteRoute)
// Admin
app.use("/api/v1/auth/admin", authAdminRoute);
app.use("/api/v1/admin", adminRoute);

// Store
app.use("/api/v1/staff", staffRoute);

// Voucher
app.use("/api/v1/voucher", voucherRoute);

// Upload Firebase
app.use("/api/v1/upload", uploadRoute);

// Store
app.use("/api/v1/store", storeRoute)
// User
app.use("/api/v1/user", userRoute)

// Rating
app.use("/api/v1/rating", ratingRoute)
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
