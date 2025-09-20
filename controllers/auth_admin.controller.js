const adminService = require("../services/admin.service");

const createAdmin = async (req, res) => {
  const payload = req.body || {};

  try {
    const admin = await adminService.createAccount(payload);
    res.status(201).json({
      message: "Admin created successfully",
      admin,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to create admin",
    });
  }
};

module.exports = {
  createAdmin,
};
