const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const { getUser, updateUser } = require("../controllers/user.controller");

const router = express.Router();

router.get("/:id", validateMongoDbId("id"), getUser);

router.put("/", authMiddleware, updateUser);

module.exports = router;
