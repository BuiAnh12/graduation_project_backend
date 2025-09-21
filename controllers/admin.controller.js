const adminService = require("../services/admin.service");
const ApiResponse = require("../utils/apiResponse");

const createAdmin = async (req, res) => {
  try {
    const admin = await adminService.createAccount(req.body || {});
    return ApiResponse.success(res, 201, "Admin created successfully", admin);
  } catch (error) {
    return ApiResponse.error(
      res,
      400,
      error.message || "Failed to create admin"
    );
  }
};

const getAllAdmins = async (req, res) => {
  try {
    const admins = await adminService.getAll();
    return ApiResponse.success(res, 200, "Get all admins successfully", admins);
  } catch (error) {
    return ApiResponse.error(res, 500, error.message || "Failed to get admins");
  }
};

const getAdminById = async (req, res) => {
  try {
    const admin = await adminService.getById(req.params.id);
    return ApiResponse.success(res, 200, "Get admin by id successfully", admin);
  } catch (error) {
    return ApiResponse.error(res, 404, error.message || "Admin not found");
  }
};

const updateAdmin = async (req, res) => {
  try {
    const admin = await adminService.edit(req.params.id, req.body || {});
    return ApiResponse.success(res, 200, "Admin updated successfully", admin);
  } catch (error) {
    return ApiResponse.error(
      res,
      400,
      error.message || "Failed to update admin"
    );
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const result = await adminService.delete(req.params.id);
    return ApiResponse.success(res, 200, "Admin deleted successfully", result);
  } catch (error) {
    return ApiResponse.error(
      res,
      404,
      error.message || "Failed to delete admin"
    );
  }
};

module.exports = {
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
};
