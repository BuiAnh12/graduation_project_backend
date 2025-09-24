const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getUserCart,
  getDetailCart,
  clearCartItem,
  clearCart,
  completeCart,
  updateCart,
  joinCart,
  leaveCart,
  applyVoucher,
  removeVoucher
} = require("../controllers/cart.controller");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const router = express.Router();

router.get("/", authMiddleware, getUserCart);
router.get("/detail/:cartId", validateMongoDbId("cartId"), authMiddleware, getDetailCart);

router.post("/update", authMiddleware, updateCart);
router.post("/complete", authMiddleware, completeCart);

router.delete("/clear/item/:storeId", authMiddleware, validateMongoDbId("storeId"), clearCartItem);
router.delete("/clear", authMiddleware, clearCart);

router.post("/join/:cartId", authMiddleware, joinCart);
router.post("/leave/:cartId", authMiddleware, leaveCart);
router.post("/voucher/:cartId", authMiddleware, applyVoucher);
router.delete("/voucher/:cartId", authMiddleware, removeVoucher)

module.exports = router;

