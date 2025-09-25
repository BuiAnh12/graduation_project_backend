const express = require("express");

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
router.get("/store/:storeId", getVouchersByStore);
router.get("/customer/:storeId", getStoreVouchersByCustomer);
router.get("/detail/:voucherId", getDetailVoucher);

router.post("/:storeId", createVoucher);
router.put("/storeId", updateVoucher);
router.delete("/:voucherId", deleteVoucher);
router.put("/toggle/:storeId", toggleVoucherActiveStatus);

module.exports = router;
