const express = require("express");
const {
  register,
  loginUser,
  getRefreshToken
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", register);
router.post("/refresh", getRefreshToken)

module.exports = router;