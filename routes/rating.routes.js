const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
// const roleAuthMiddleware = require("../middlewares/roleAuthMiddleware")
const {
  getAllStoreRating,
  getDetailRating,
  addStoreRating,
  editStoreRating,
  deleteStoreRating,
  getRatingsByStore,
  replyToRating
} = require("../controllers/rating.controller");

const router = express.Router();

router.get("/:storeId", validateMongoDbId("storeId"), getAllStoreRating);
router.get("/detail/:ratingId", validateMongoDbId("ratingId"), getDetailRating);

router.post("/add-rating", authMiddleware, addStoreRating);

router.put("/edit-rating/:ratingId", authMiddleware, validateMongoDbId("ratingId"), editStoreRating);

router.delete("/delete-rating/:ratingId", authMiddleware, validateMongoDbId("ratingId"), deleteStoreRating);

// GET /api/v1/rating?replied=true|false|undefined&page=1&limit=10&sort=-createdAt
router.get("/", authMiddleware, getRatingsByStore);

router.patch("/:id/reply", authMiddleware, replyToRating);

module.exports = router;
