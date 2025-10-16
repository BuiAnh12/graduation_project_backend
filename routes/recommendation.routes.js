const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  predictTag,
  recommendDish,
  similarDish,
  behaviorTest,
} = require("../controllers/recommendation.controller");

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
router.post("/dish", recommendDish);
router.post("/dish/similar", similarDish);
router.post("/behavior/test", behaviorTest);

module.exports = router;
