require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db_connection");
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const http = require("http");
const socketIo = require("socket.io");
const { setSocketIo, getUserSockets } = require("./utils/socketManager");
const Notification = require("./models/notifications.model");

// Route import
const authRoute = require("./routes/auth.route");
const cartRoute = require("./routes/cart.route");
const adminRoute = require("./routes/admin.routes");
const authAdminRoute = require("./routes/auth.admin.routes");
const authStaffRoute = require("./routes/auth.staff.routes");
const authShipperRoute = require("./routes/auth.shipper.route");
const voucherRoute = require("./routes/voucher.routes");
const staffRoute = require("./routes/staff.routes");
const uploadRoute = require("./routes/upload.routes");
const userRoute = require("./routes/user.route");
const favoriteRoute = require("./routes/favorite.routes");
const orderRoute = require("./routes/order.route");
const paymentRoute = require("./routes/order.route");
const storeRoute = require("./routes/store.route");
const ratingRoute = require("./routes/rating.routes");
const systemCategoryRoute = require("./routes/systemCategory.routes");
const notificationRoute = require("./routes/notification.routes");
const locationRoute = require("./routes/location.routes");
const shippingFeeRoute = require("./routes/shippingFee.routes");
const categoryRoute = require("./routes/category.route");
const toppingGroupRoute = require("./routes/toppingGroup.route");
const toppingRoute = require("./routes/topping.route");
const dishRoute = require("./routes/dish.route");
const tagsRoute = require("./routes/tags.routes");
const statisticsStoreRoute = require("./routes/statistics.store.route");
const statisticsAdminRoute = require("./routes/statistics.admin.route");
const shipperRoute = require("./routes/shipper.route");
const recommendRoute = require("./routes/recommendation.routes");

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
app.use("/api/v1/order", orderRoute);

// Payment
app.use("/api/v1/payment", paymentRoute);

// Favorite
app.use("/api/v1/favorite", favoriteRoute);
// Admin
app.use("/api/v1/auth/admin", authAdminRoute);
// Staff
app.use("/api/v1/auth/staff", authStaffRoute);
// Auth shipper
app.use("/api/v1/auth/shipper", authShipperRoute);

app.use("/api/v1/admin", adminRoute);

// Store
app.use("/api/v1/staff", staffRoute);

// Voucher
app.use("/api/v1/voucher", voucherRoute);

// Upload Firebase
app.use("/api/v1/upload", uploadRoute);

// Store
app.use("/api/v1/store", storeRoute);
// User
app.use("/api/v1/user", userRoute);

// System Category
app.use("/api/v1/system-categories", systemCategoryRoute);

// Rating
app.use("/api/v1/rating", ratingRoute);

// Notification
app.use("/api/v1/notification", notificationRoute);

// Location
app.use("/api/v1/location", locationRoute);

// Shipping Fee
app.use("/api/v1/shipping-fee", shippingFeeRoute);
// Category
app.use("/api/v1/category", categoryRoute);
// Topping group
app.use("/api/v1/topping-group", toppingGroupRoute);
// Topping
app.use("/api/v1/topping", toppingRoute);
// Dish
app.use("/api/v1/dish", dishRoute);
// Dish
app.use("/api/v1/tags", tagsRoute);
// Store statistic
app.use("/api/v1/statistics/store", statisticsStoreRoute);
// Admin statistic
app.use("/api/v1/statistics/admin", statisticsAdminRoute);
// Shipper
app.use("/api/v1/shipper", shipperRoute);
// Recommend AI
app.use("/api/v1/recommend", recommendRoute);

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

setSocketIo(io); // Make io accessible everywhere
const userSockets = getUserSockets();

io.on("connection", (socket) => {
  socket.on("registerUser", async (userId) => {
    // Nếu userId chưa có trong userSockets, tạo mảng mới
    if (!userSockets[userId]) {
      userSockets[userId] = [];
    }

    // Thêm socket id vào mảng của user
    userSockets[userId].push(socket.id);

    console.log(`User ${userId} connected with socket ID: ${socket.id}`);

    // Khi user kết nối, lấy tất cả thông báo của họ
    try {
      const allNotifications = await Notification.find({ userId }).sort({
        createdAt: -1,
      });
      console.log(allNotifications);
      socket.emit("getAllNotifications", allNotifications); // Gửi về client
    } catch (error) {
      console.error("Lỗi lấy thông báo:", error);
    }
  });

  // Gửi thông báo đến tất cả các thiết bị của một user
  socket.on("sendNotification", async ({ userId, title, message, type }) => {
    try {
      const newNotification = new Notification({
        userId,
        title,
        message,
        type,
      });
      await newNotification.save();

      // Gửi thông báo đến tất cả các socket ids của userId
      if (userSockets[userId]) {
        userSockets[userId].forEach((socketId) => {
          io.to(socketId).emit("newNotification", newNotification);
        });
      }
    } catch (error) {
      console.error("Lỗi gửi thông báo:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (let userId in userSockets) {
      const socketIndex = userSockets[userId].indexOf(socket.id);
      if (socketIndex !== -1) {
        userSockets[userId].splice(socketIndex, 1);
        console.log(
          `User ${userId} disconnected, removed socket ID: ${socket.id}`
        );
        break;
      }
    }
  });
});

// server.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });
const os = require("os");
const networkInterfaces = os.networkInterfaces();
const address = Object.values(networkInterfaces)
  .flat()
  .find((iface) => iface.family === "IPv4" && !iface.internal)?.address;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running at:`);
  console.log(`- Local:    http://localhost:${PORT}`);
  console.log(`- Network:  http://${address}:${PORT}`);
});
