const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const {
  getVouchersByStore,
  getStoreVouchersByCustomer,
  getDetailVoucher,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  toggleVoucherActiveStatus,
} = require("../controllers/voucher.controller");

const router = express.Router();

// Generate QR code (payment URL)
router.get(
  "/store/:storeId",
  authMiddleware,
  validateMongoDbId("storeId"),
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  getVouchersByStore
);
router.get("/customer/:storeId", getStoreVouchersByCustomer);
router.get("/detail/:voucherId", getDetailVoucher);

router.post(
  "/:storeId",
  authMiddleware,
  validateMongoDbId("storeId"),
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  createVoucher
);
router.put(
  "/:voucherId",
  authMiddleware,
  validateMongoDbId("voucherId"),
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  updateVoucher
);
router.delete(
  "/:voucherId",
  authMiddleware,
  validateMongoDbId("voucherId"),
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  deleteVoucher
);
router.put(
  "/toggle/:storeId/:voucherId",
  authMiddleware,
  validateMongoDbId("storeId"),
  validateMongoDbId("voucherId"),
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  toggleVoucherActiveStatus
);

module.exports = router;
