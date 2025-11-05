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
  removeVoucher,
  enableGroupCartController,
  joinGroupCartController,
  getGroupCartController,
  upsertGroupCartItemController,
  lockGroupCartController,
  unlockGroupCartController,
  completeGroupCartController,
  deleteGroupCartController,
  leaveGroupCartController,
  removeParticipantController
} = require("../controllers/cart.controller");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const router = express.Router();

router.get("/", authMiddleware, getUserCart);
router.get("/:cartId", validateMongoDbId("cartId"), authMiddleware, getDetailCart);

router.post("/update", authMiddleware, updateCart);
router.post("/complete", authMiddleware, completeCart);

router.delete("/clear/item/:storeId", authMiddleware, validateMongoDbId("storeId"), clearCartItem);
router.delete("/clear", authMiddleware, clearCart);

router.post("/:cartId/voucher", authMiddleware, applyVoucher);
router.delete("/:cartId/voucher", authMiddleware, removeVoucher)

// --- Group Cart Main ---
router.patch("/group/enable", authMiddleware, enableGroupCartController); // Step 1: Owner creates group
router.post("/join/:privateToken", authMiddleware, joinGroupCartController); // Step 2: Participant joins
router.get("/group/:cartId", authMiddleware, getGroupCartController); // Step 3: Everyone views the cart
router.patch("/group/:cartId/lock", authMiddleware, lockGroupCartController); // Step 4: Owner locks cart
router.post("/group/:cartId/complete", authMiddleware, completeGroupCartController); // Step 5: Owner places order
router.delete("/group/:cartId", authMiddleware, deleteGroupCartController);

// --- Group Cart Item Management ---
router.post("/group/upsert", authMiddleware, upsertGroupCartItemController);


// --- Group Cart State Management ---
router.patch("/group/:cartId/unlock", authMiddleware, unlockGroupCartController); // Owner can unlock if needed
router.post("/group/:cartId/leave", authMiddleware, leaveGroupCartController); // A participant leaves
router.delete("/group/:cartId/participant/:participantId", authMiddleware, removeParticipantController);

module.exports = router;

