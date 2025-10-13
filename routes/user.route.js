const express = require("express");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");
const {
  getUser,
  updateUser,
  getAllUser,
  toggleUserAccountStatus,
} = require("../controllers/user.controller");

const router = express.Router();
router.get(
  "/all",
  authMiddleware,
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CUSTOMER_MANAGER"],
  }),
  getAllUser
);
router.get("/:id", validateMongoDbId("id"), getUser);

router.put("/", authMiddleware, updateUser);

router.put(
  "/:userId/toggle-status",
  authMiddleware,
  validateMongoDbId("userId"),
  authorizeMiddleware({
    admin: ["SUPER_ADMIN", "CUSTOMER_MANAGER"],
  }),
  toggleUserAccountStatus
);

module.exports = router;
