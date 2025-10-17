const express = require("express");
const {
  getProfile,
  updateProfileInfo,
  checkCurrentPassword,
  resetPassword,
  forgetPassword,
  verifyOtp,
  resetPasswordWithEmail,
} = require("../controllers/auth.staff.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/profile", authMiddleware, getProfile);
router.put("/profile/info", authMiddleware, updateProfileInfo);
router.post(
  "/profile/check-current-password",
  authMiddleware,
  checkCurrentPassword
);
router.put("/profile/password", authMiddleware, resetPassword);

// Auth
router.post("/forgot-password", forgetPassword);
router.post("/verify-otp", verifyOtp);
router.put("/reset-password", resetPasswordWithEmail);
module.exports = router;
