const express = require("express");
const {
  getShipperRequest,
  approveShipperRequest,
  getAllShippers,
  toggleShipperAccountStatus,
  updateCurrentLocation,
  updateOnlineStatus,
} = require("../controllers/shipper.controller");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const router = express.Router();

// Request
router.get(
  "/request",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "SHIPPER_MANAGER"],
  }),
  getShipperRequest
);
router.put(
  "/:shipperId/approve",
  authMiddleware,
  validateMongoDbId("shipperId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "SHIPPER_MANAGER"],
  }),
  approveShipperRequest
);
router.get(
  "/all",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "SHIPPER_MANAGER"],
  }),
  getAllShippers
);
router.put(
  "/:shipperId/toggle-status",
  authMiddleware,
  validateMongoDbId("shipperId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "SHIPPER_MANAGER"],
  }),
  toggleShipperAccountStatus
);

router.put("/update-location", authMiddleware, updateCurrentLocation);

router.patch("/online", authMiddleware, updateOnlineStatus);
module.exports = router;
