const express = require("express");
const {
  getDashboardSummary,
  getStoreSummary,
  getUserSummary,
  getShipperSummary,
} = require("../controllers/statistics.admin.controller");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const router = express.Router();

// Revenue
router.get("/dashboard", authMiddleware, getDashboardSummary);
router.get(
  "/store",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER"],
  }),
  getStoreSummary
);
router.get(
  "/user",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER"],
  }),
  getUserSummary
);
router.get(
  "/shipper",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER"],
  }),
  getShipperSummary
);

module.exports = router;
