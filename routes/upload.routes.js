const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  uploadAvatarImage,
  uploadImages,
  deleteFile,
} = require("../controllers/upload.controller");
const { uploadToFirebase } = require("../config/firebase_connection");
const router = express.Router();

router.post(
  "/avatar",
  authMiddleware,
  uploadToFirebase.single("file"),
  uploadAvatarImage
);
router.post("/images", uploadToFirebase.array("files", 10), uploadImages);
router.post(
  "/register/images",
  uploadToFirebase.array("file", 10),
  uploadImages
);
router.delete("/delete-file", authMiddleware, deleteFile);
module.exports = router;
