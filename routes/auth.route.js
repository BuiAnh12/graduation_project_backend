const express = require("express");
const {
  register,
  loginUser,
  loginStaff,
  changePassword,
  resetPassword,
  forgotPassword,
  checkOTP,
  storeOwnByUser,
  logout,
  checkRegisterStoreOwner,
  loginAdmin,
  loginShipper,
  refreshTokenUser,
  refreshTokenAdmin,
  refreshTokenShipper,
  refreshTokenStaff,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/login", loginUser);
router.post("/login/staff", loginStaff);
router.post("/login/admin", loginAdmin);
router.post("/login/shipper", loginShipper);
router.post("/register", register);
router.get("/refresh/user", refreshTokenUser);
router.get("/refresh/admin", refreshTokenAdmin);
router.get("/refresh/shipper", refreshTokenShipper);
router.get("/refresh/staff", refreshTokenStaff);

// router.post("/register/store-owner", registerStoreOwner);
router.get("/check-register-store-owner/:email", checkRegisterStoreOwner);
// router.post("/store", authMiddleware, storeOwnByUser);
router.post("/forgot-password", forgotPassword);
router.post("/check-otp", checkOTP);

router.get("/logout", logout);

router.put("/change-password", authMiddleware, changePassword);
// router.put("/reset-password", resetPassword);

module.exports = router;
