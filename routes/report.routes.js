const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const {
  getAllReason,
  createReason,
  updateReason,
  deleteReason,
  getAllReport,
  getReportById,
  createReport,
  updateReportStatus,
  deleteReport,
} = require("../controllers/report.controller");

const router = express.Router();
// Reason
router.get("/reason", getAllReason);
router.post(
  "/reason",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  createReason
);
router.put(
  "/reason/:reasonId",
  authMiddleware,
  validateMongoDbId("reasonId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  updateReason
);
router.delete(
  "/reason/:reasonId",
  authMiddleware,
  validateMongoDbId("reasonId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  deleteReason
);
// Report
router.get(
  "/",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  getAllReport
);
router.get(
  "/:report_id",
  authMiddleware,
  validateMongoDbId("report_id"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  getReportById
);
router.post("/", authMiddleware, createReport);
router.put(
  "/status/:reportId",
  authMiddleware,
  validateMongoDbId("reportId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  updateReportStatus
);
router.delete(
  "/:reportId",
  authMiddleware,
  validateMongoDbId("reportId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  deleteReport
);

module.exports = router;
