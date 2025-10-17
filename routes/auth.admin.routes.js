const express = require("express");
const {
  getProfile,
  updateProfileInfo,
  checkCurrentPassword,
  resetPassword,
} = require("../controllers/auth.admin.controller");
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
module.exports = router;
