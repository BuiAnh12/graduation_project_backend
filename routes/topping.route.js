const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");

const {
  getAllToppingsByGroup,
  getTopping,
  createTopping,
  updateTopping,
  deleteTopping,
} = require("../controllers/topping.controller");

const router = express.Router();

router.get(
  "/group/:toppingGroupId",
  validateMongoDbId("toppingGroupId"),
  getAllToppingsByGroup
);

router.get("/:id", validateMongoDbId("id"), getTopping);

router.post(
  "/",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  createTopping
);

router.put(
  "/:id",
  validateMongoDbId("id"),
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  updateTopping
);

router.delete(
  "/:id",
  validateMongoDbId("id"),
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  deleteTopping
);

module.exports = router;
