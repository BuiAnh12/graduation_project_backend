const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const {
  addLocation,
  getLocation,
  getUserLocations,
  updateLocation,
  deleteLocation,
} = require("../controllers/location.controller");

const router = express.Router();

router.post("/add-location", authMiddleware, addLocation);

router.get("/get-location/:id", authMiddleware, validateMongoDbId("id"), getLocation);
router.get("/get-user-locations", authMiddleware, getUserLocations);

router.put("/update-location/:id", authMiddleware, validateMongoDbId("id"), updateLocation);

router.delete("/delete-location/:id", authMiddleware, validateMongoDbId("id"), deleteLocation);

module.exports = router;
