const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const {
  getAllStaffByStore,
  createStaff,
  updateStaff,
  getStaffById,
  deleteStaff,
  checkEmail,
  toggleAccoutStaffStatus,
} = require("../controllers/staff.controller");

const router = express.Router();

router.get(
  "/store/:storeId",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  getAllStaffByStore
);
router.post(
  "/",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  createStaff
);
router.post("/check-email", checkEmail);
router.put(
  "/:staffId/toggle-status",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  toggleAccoutStaffStatus
);
router.put(
  "/:staffId",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  updateStaff
);
router.get("/detail/:staffId", getStaffById);
router.delete(
  "/:storeId/:staffId",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  deleteStaff
);
module.exports = router;
