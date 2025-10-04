const express = require("express");
const {
  getAllStaffByStore,
  createStaff,
  updateStaff,
  getStaffById,
  deleteStaff,
  checkEmail,
} = require("../controllers/staff.controller");

const router = express.Router();

router.get("/store/:storeId", getAllStaffByStore);
router.post("/", createStaff);
router.post("/check-email", checkEmail);
router.put("/:staffId", updateStaff);
router.get("/staff/:staffId", getStaffById);
router.delete("/", deleteStaff);
module.exports = router;
