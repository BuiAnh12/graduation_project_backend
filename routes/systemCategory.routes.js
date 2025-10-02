const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const {
  getAllSystemCategory,
  getSystemCategory,
  createSystemCategory,
  updateSystemCategory,
  deleteSystemCategory,
} = require("../controllers/systemCategory.controller");

const router = express.Router();

router.get("/", getAllSystemCategory);
router.get("/:id", validateMongoDbId("id"), getSystemCategory);

router.post("/", createSystemCategory);

router.put("/:id", updateSystemCategory);
router.delete("/:id", deleteSystemCategory);

module.exports = router;
