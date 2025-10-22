const express = require("express");
const {
  getUserReference,
  updateUserReference,
  deleteUserReference,
} = require("../controllers/userReference.controller");

const {
    getAllTags
} = require("../controllers/userReferenceTag.controller")
const authMiddleware = require("../middlewares/authMiddleware");


const router = express.Router();

router.get("/", authMiddleware, getUserReference);
router.put("/", authMiddleware, updateUserReference);
router.delete("/", authMiddleware, deleteUserReference);
router.get("/all", getAllTags)

module.exports = router;
