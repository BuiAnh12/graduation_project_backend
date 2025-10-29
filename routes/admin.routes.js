const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");
const optionalAuthMiddleware = require("../middlewares/optionalAuthMiddleware")
const {
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  toggleAccoutAdminStatus,
  triggerExport,
  triggerTrain,
  reloadModel,
  getJobStatus
} = require("../controllers/admin.controller");

const router = express.Router();

router.post("/ai/data/export", optionalAuthMiddleware, triggerExport)
router.post("/ai/model/train", optionalAuthMiddleware, triggerTrain)
router.post("/ai/model/reload", optionalAuthMiddleware, reloadModel)
router.post("/ai/jobs/status/:jobId", optionalAuthMiddleware, getJobStatus)

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
