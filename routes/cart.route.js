const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getUserCart
} = require("../controllers/cart.controller");
const router = express.Router();

router.get("/", getUserCart);

module.exports = router;
