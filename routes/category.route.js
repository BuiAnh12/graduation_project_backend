const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const {
  getAllCategoryByStore,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

const router = express.Router();

router.get("/store/:storeId", validateMongoDbId("storeId"), getAllCategoryByStore);

router.get("/:id", validateMongoDbId("id"), getCategory);

router.post(
  "/",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  createCategory
);

router.put(
  "/:id",
  validateMongoDbId("id"),
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  updateCategory
);

router.delete(
  "/:id",
  validateMongoDbId("id"),
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  deleteCategory
);

module.exports = router;
