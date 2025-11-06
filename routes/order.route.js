const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");
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
  cancelOrder,
  takeOrder,
  startDelivery,
  markDelivered,
  completeOrder,
  getOngoingOrder,
  getDetailOrderDirection,
  getHistoryShipperOrder,
  cancelOrderShipper,
  cancelOrderStore,
  finishOrder,
  getOrderDetailForShipper,
  rejectOrder,
} = require("../controllers/order.controller");

const router = express.Router();

router.get("/", authMiddleware, getUserOrders);
router.get("/monthly-stats", getMonthlyOrderStats);
router.get("/finished", authMiddleware, getFinishedOrders);
router.get("/stats", getOrderStats);
router.get("/ongoing", authMiddleware, getOngoingOrder);
router.get("/shipper-history", authMiddleware, getHistoryShipperOrder);

router.get(
  "/:orderId/direction",
  authMiddleware,
  validateMongoDbId("orderId"),
  getDetailOrderDirection
);
router.get(
  "/:orderId/store",
  authMiddleware,
  validateMongoDbId("orderId"),
  getOrderDetailForStore
);
router.get(
  "/:orderId/shipper",
  validateMongoDbId("orderId"),
  getOrderDetailForShipper
);
router.get(
  "/store/:storeId",
  validateMongoDbId("storeId"),
  authMiddleware,
  authorizeMiddleware({
    admin: ["super_admin", "manager"],
    staff: ["STORE_OWNER", "MANAGER", "STAFF"],
  }),
  getAllOrder
);
router.get("/:orderId", validateMongoDbId("orderId"), getOrderDetail);
router.post("/re-order/:orderId", authMiddleware, reOrder);

router.put("/:orderId/update-status", authMiddleware, updateOrderStatus);
router.put("/:orderId/cancel-order", authMiddleware, cancelOrder);
router.put("/:order_id", updateOrder);

// shipper route
router.patch("/:orderId/taken", authMiddleware, takeOrder);
router.patch("/:orderId/reject", authMiddleware, rejectOrder);
router.patch("/:orderId/delivering", authMiddleware, startDelivery);
router.patch("/:orderId/delivered", authMiddleware, markDelivered);
router.patch("/:orderId/complete", authMiddleware, completeOrder);
router.patch("/:orderId/cancel-shipper", authMiddleware, cancelOrderShipper);
router.patch(
  "/:orderId/cancel-store",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER", "STAFF"],
  }),
  cancelOrderStore
);
router.patch(
  "/:orderId/finish",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER", "STAFF"],
  }),
  finishOrder
);
module.exports = router;
