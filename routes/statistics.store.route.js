const express = require("express");
const {
  getRevenueSummary,
  getRevenueByDay,
  getRevenueByItem,
  getRevenueByCategory,
  getOrderStatusRate,
  getOrdersOverTime,
  getOrderStatusDistribution,
  getOrdersByTimeSlot,
  getTopSellingItems,
  getRevenueContributionByItem,
  getNewCustomers,
  getReturningCustomerRate,
  getAverageSpendingPerOrder,
  getVoucherUsageSummary,
  getTopUsedVouchers,
  getVoucherRevenueImpact,
  getOrderSummaryStats,
} = require("../controllers/statistics.store.controller");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const router = express.Router();

// Revenue
router.get(
  "/revenue/summary",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getRevenueSummary
);
router.get(
  "/revenue/by-day",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getRevenueByDay
);
router.get(
  "/revenue/by-item",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getRevenueByItem
);
router.get(
  "/revenue/by-category",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getRevenueByCategory
);

// Order
router.get(
  "/order/status-rate",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getOrderStatusRate
);
router.get(
  "/order/summary",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getOrderSummaryStats
);
router.get(
  "/order/over-time",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getOrdersOverTime
);
router.get(
  "/order/status-distribution",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getOrderStatusDistribution
);
router.get(
  "/order/by-time-slot",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getOrdersByTimeSlot
);

// Others
router.get(
  "/top-selling-items",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getTopSellingItems
);
router.get(
  "/items/revenue-contribution",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getRevenueContributionByItem
);

// Customer
router.get(
  "/customers/new",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getNewCustomers
);
router.get(
  "/customers/returning-rate",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getReturningCustomerRate
);
router.get(
  "/customers/average-spending",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getAverageSpendingPerOrder
);
// Voucher
router.get(
  "/vouchers/usage-summary",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getVoucherUsageSummary
);
router.get(
  "/vouchers/top-used",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getTopUsedVouchers
);
router.get(
  "/vouchers/revenue-impact",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  getVoucherRevenueImpact
);
module.exports = router;
