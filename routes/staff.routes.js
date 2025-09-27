const express = require("express");
const {
  getAllStaffByStore,
  createStaff,
  updateStaff,
  getStaffById,
  deleteStaff,
} = require("../controllers/staff.controller");

const router = express.Router();

router.get("/store/:storeId", getAllStaffByStore);
router.post("/", createStaff);
router.put("/:staffId", updateStaff);
router.get("/staff/:staffId", getStaffById);
router.delete("/", deleteStaff);
module.exports = router;
