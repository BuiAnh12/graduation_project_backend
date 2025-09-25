const express = require("express");

const {
  getQRCode,
  handleVnpReturn,
} = require("../controllers/payment.controller");

const router = express.Router();

// Generate QR code (payment URL)
router.post("/vnpay/qrcode/:cartId", getQRCode);

// Return URL handler (VNPay will redirect user here)
router.get("/vnpay/return", handleVnpReturn);

module.exports = router;
