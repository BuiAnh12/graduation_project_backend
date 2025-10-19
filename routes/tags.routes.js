const express = require("express");

const {
  getAllCookingMethodTags,
  getAllCultureTags,
  getAllFoodTags,
  getAllTasteTags,
  getAllTags,
} = require("../controllers/tags.controller");

const router = express.Router();

router.get("/cooking-method", getAllCookingMethodTags);
router.get("/culture", getAllCultureTags);
router.get("/food", getAllFoodTags);
router.get("/taste", getAllTasteTags);
router.get("/all", getAllTags);

module.exports = router;
