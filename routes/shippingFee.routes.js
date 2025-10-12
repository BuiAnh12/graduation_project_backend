const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const {
  getAllShippingFees,
  createShippingFee,
  updateShippingFee,
  deleteShippingFee,
  calculateShippingFee,
} = require("../controllers/shippingFee.controller");

const router = express.Router();
router.get("/", getAllShippingFees);

router.post(
  "/",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "SYSTEM_MANAGER"],
  }),
  createShippingFee
);

router.put(
  "/:feeId",
  authMiddleware,
  validateMongoDbId("feeId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "SYSTEM_MANAGER"],
  }),
  updateShippingFee
);

router.delete(
  "/:feeId",
  authMiddleware,
  validateMongoDbId("feeId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "SYSTEM_MANAGER"],
  }),
  deleteShippingFee
);

router.get("/calculate", calculateShippingFee);

module.exports = router;
