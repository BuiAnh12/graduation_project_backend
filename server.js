require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db_connection");
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const adminManager = require("./routes/admin.routes");
// Route import
const authRoute = require("./routes/auth.route");
const cartRoute = require("./routes/cart.route");

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

// Routes
app.use("/api/v1/auth", authRoute);

// Basic route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// Route
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/cart", cartRoute);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
