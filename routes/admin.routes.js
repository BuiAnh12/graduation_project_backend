const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");
const {
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  toggleAccoutAdminStatus,
} = require("../controllers/admin.controller");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "HR_MANAGER"],
  }),
  createAdmin
);
router.get(
  "/",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "HR_MANAGER"],
  }),
  getAllAdmins
);
router.get("/:id", getAdminById);
router.put(
  "/:id",
  authMiddleware,
  validateMongoDbId("id"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "HR_MANAGER"],
  }),
  updateAdmin
);
router.delete(
  "/:id",
  authMiddleware,
  validateMongoDbId("id"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "HR_MANAGER"],
  }),
  deleteAdmin
);

router.put(
  "/:adminId/toggle-status",
  authMiddleware,
  validateMongoDbId("adminId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "HR_MANAGER"],
  }),
  toggleAccoutAdminStatus
);
module.exports = router;
