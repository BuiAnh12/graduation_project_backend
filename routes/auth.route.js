const express = require("express");
const {
  register,
  loginUser,
  getRefreshToken,
  loginStaff,
  changePassword,
  resetPassword,
  forgotPassword,
  checkOTP,
  storeOwnByUser,
  logout,
  checkRegisterStoreOwner,
  loginAdmin,
} = require("../controllers/auth.controller");
const authMiddleware = require('../middlewares/authMiddleware')
const router = express.Router();

router.post("/login", loginUser);
router.post("/login/staff", loginStaff);
router.post("/login/admin", loginAdmin);
router.post("/register", register);
router.post("/refresh", getRefreshToken)

// router.post("/register/store-owner", registerStoreOwner);
router.get("/check-register-store-owner/:email", checkRegisterStoreOwner);
// router.post("/store", authMiddleware, storeOwnByUser);
router.post("/forgot-password", forgotPassword);
router.post("/check-otp", checkOTP);

router.get("/logout", logout);

router.put("/change-password", authMiddleware, changePassword);
// router.put("/reset-password", resetPassword);

module.exports = router;