const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const {
  getAllSystemCategory,
  getSystemCategory,
  createSystemCategory,
  updateSystemCategory,
  deleteSystemCategory,
  getAllSystemCategoriesWithCount,
} = require("../controllers/systemCategory.controller");

const router = express.Router();

router.get(
  "/count",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "SYSTEM_MANAGER"],
  }),
  getAllSystemCategoriesWithCount
);

router.get("/", getAllSystemCategory);
router.get("/:id", validateMongoDbId("id"), getSystemCategory);

router.post(
  "/",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "SYSTEM_MANAGER"],
  }),
  createSystemCategory
);

router.put(
  "/:id",
  validateMongoDbId("id"),
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "SYSTEM_MANAGER"],
  }),
  updateSystemCategory
);

router.delete(
  "/:id",
  validateMongoDbId("id"),
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "SYSTEM_MANAGER"],
  }),
  deleteSystemCategory
);

module.exports = router;
