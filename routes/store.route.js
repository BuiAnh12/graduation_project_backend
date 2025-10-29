const express = require("express");
const {
  registerStore,
  getAllStore,
  getStoreInformation,
  getAllDishInStore,
  getDetailDish,
  checkStoreStatus,
  getStoreDetailInfo,
  toggleStoreOpenStatus,
  updateOpenCloseHours,
  updateStoreInfo,
  updateStoreAddress,
  updateStoreImages,
  updateStorePaperWork,
  getStoresByStatus,
  approveStore,
  blockStore,
  unblockedStore,
  getStoreDetailForAdmin,
} = require("../controllers/store.controller");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");
const optionalAuthMiddleware = require("../middlewares/optionalAuthMiddleware")

const router = express.Router();

// Public
router.get("/all", getAllStore);
router.post("/register", registerStore);
router.get("/dish/:dishId", validateMongoDbId("dishId"), getDetailDish);
router.get("/:storeId/status", checkStoreStatus);
router.get("/:storeId/dish", validateMongoDbId("storeId"),optionalAuthMiddleware ,getAllDishInStore);
router.get("/:storeId", validateMongoDbId("storeId"), getStoreInformation);

// Staff
router.get(
  "/:storeId/info",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
    staff: ["STORE_OWNER"],
  }),
  getStoreDetailInfo
);

router.patch(
  "/:storeId/toggle-status",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  toggleStoreOpenStatus
);

router.patch(
  "/:storeId/update-hour",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  updateOpenCloseHours
);

router.patch(
  "/:storeId/update-info",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  updateStoreInfo
);

router.patch(
  "/:storeId/update-address",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  updateStoreAddress
);

router.patch(
  "/:storeId/update-image",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  updateStoreImages
);

router.patch(
  "/:storeId/update-paperwork",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER"],
  }),
  updateStorePaperWork
);

// ADMIN
router.get(
  "/status/:status",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  getStoresByStatus
);

router.put(
  "/:storeId/approve",
  authMiddleware,
  validateMongoDbId("storeId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  approveStore
);

router.put(
  "/:storeId/block",
  authMiddleware,
  validateMongoDbId("storeId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  blockStore
);

router.put(
  "/:storeId/unblock",
  authMiddleware,
  validateMongoDbId("storeId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  unblockedStore
);

router.get(
  "/:storeId/detail",
  authMiddleware,
  validateMongoDbId("storeId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CHIEF_MANAGER", "STORE_MANAGER"],
  }),
  getStoreDetailForAdmin
);

module.exports = router;
