const express = require("express");
const { createAdmin } = require("../controllers/auth_admin.controller");

const router = express.Router();

router.post("/register", createAdmin);
module.exports = router;