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
} = require("../controllers/store.controller");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const router = express.Router();

router.get("/all", getAllStore);
router.get("/:storeId", validateMongoDbId("storeId"), getStoreInformation);
router.get("/:storeId/status", checkStoreStatus);
router.post("/register", registerStore);
router.get("/:storeId/dish", validateMongoDbId("storeId"), getAllDishInStore);
router.get("/dish/:dishId", validateMongoDbId("dishId"), getDetailDish);

router.get(
  "/:storeId/info",
  authMiddleware,
  authorizeMiddleware({
    admin: ["super_admin", "manager"],
    staff: ["STORE_OWNER", "manager"],
  }),
  getStoreDetailInfo
);

router.patch(
  "/:storeId/toggle-status",
  authMiddleware,
  authorizeMiddleware({
    admin: ["super_admin", "manager"],
    staff: ["STORE_OWNER", "manager"],
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

module.exports = router;
