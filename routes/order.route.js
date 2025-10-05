const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const validateMongoDbId = require("../middlewares/validateMongoDBId");

const {
  getUserOrders,
  getOrderDetail,
  getFinishedOrders,
  updateOrderStatus,
  getOrderStats,
  getMonthlyOrderStats,
  getAllOrder,
  updateOrder,
  getOrderDetailForStore,
  reOrder,
  cancelOrder
} = require("../controllers/order.controller");

const router = express.Router();

router.get("/", authMiddleware, getUserOrders);
router.get("/monthly-stats", getMonthlyOrderStats);
router.get("/finished", authMiddleware, getFinishedOrders);
router.get("/stats", getOrderStats);
router.get("/:orderId", validateMongoDbId("orderId"), getOrderDetail);
router.get("/:orderId/store", authMiddleware, validateMongoDbId("orderId"), getOrderDetailForStore);
router.get("/store/:storeId", validateMongoDbId("storeId"), getAllOrder);

router.post("/re-order/:orderId", authMiddleware, reOrder);

router.put("/:orderId/update-status", authMiddleware, updateOrderStatus);
router.put("/:orderId/cancel-order", authMiddleware, cancelOrder);
router.put("/:order_id", updateOrder);

module.exports = router;