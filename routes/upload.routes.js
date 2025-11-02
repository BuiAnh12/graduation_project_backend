const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  uploadAvatarImage,
  uploadImages,
  deleteFile,
  uploadShipperAvatarImage,
} = require("../controllers/upload.controller");
const multer = require("multer");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/avatar",
  authMiddleware,
  upload.single("file"),
  uploadAvatarImage
);
router.post(
  "/shipper-avatar",
  authMiddleware,
  upload.single("file"),
  uploadShipperAvatarImage
);
router.post("/images", upload.array("files", 10), uploadImages);
router.post("/register/images", upload.array("file", 10), uploadImages);
router.delete("/delete-file", authMiddleware, deleteFile);

module.exports = router;
