const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const {
  getAllToppingGroupByStore,
  getToppingGroupDetail,
  createToppingGroup,
  updateToppingGroup,
  deleteToppingGroup,
} = require("../controllers/toppingGroup.controller");

const router = express.Router();

router.get(
  "/store/:storeId",
  validateMongoDbId("storeId"),
  getAllToppingGroupByStore
);

router.get("/:id", validateMongoDbId("id"), getToppingGroupDetail);

router.post(
  "/",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  createToppingGroup
);

router.put(
  "/:id",
  validateMongoDbId("id"),
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  updateToppingGroup
);

router.delete(
  "/:id",
  validateMongoDbId("id"),
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  deleteToppingGroup
);

module.exports = router;
