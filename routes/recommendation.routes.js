const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  predictTag,
  recommendDish,
  similarDish,
  behaviorTest,
  extractTags,
  optimizeDescription,
  recommendTagsForOrder,
  refreshUserEmbedding,
  refreshDishEmbedding,
} = require("../controllers/recommendation.controller");
const optionalAuthMiddleware = require("../middlewares/optionalAuthMiddleware")
const authMiddleware = require("../middlewares/authMiddleware")

const router = express.Router();

// Multer: Save uploaded image temporarily
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/temp");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post("/tag/predict", upload.single("image"), predictTag);
router.post("/dish", optionalAuthMiddleware, recommendDish);
router.post("/dish/similar", optionalAuthMiddleware, similarDish);
router.post("/behavior/test", behaviorTest);
router.post("/text/extract-tags", extractTags);
router.post("/text/optimize-description", optimizeDescription);
router.post("/tags/recommend-order", optionalAuthMiddleware, recommendTagsForOrder);

router.post("/refresh/user", authMiddleware, refreshUserEmbedding);
router.post("/refresh/dish", authMiddleware, refreshDishEmbedding);

module.exports = router;
