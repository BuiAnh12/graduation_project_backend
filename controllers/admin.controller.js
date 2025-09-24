const ErrorCode = require("../constants/errorCodes.enum");
const {
  createAccountService,
  getAllAdService,
  getAdminByIdService,
  editAdminService,
  deleteAdminService,
} = require("../services/admin.service");
const ApiResponse = require("../utils/apiResponse");

const createAdmin = async (req, res) => {
  try {
    const admin = await createAccountService(req.body || {});
    return ApiResponse.success(res, admin, "Admin created successfully", 201);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const getAllAdmins = async (req, res) => {
  try {
    const admins = await getAllAdService();
    return ApiResponse.success(res, admins, "Get all admins successfully");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const getAdminById = async (req, res) => {
  try {
    const admin = await getAdminByIdService(req.params.id);
    return ApiResponse.success(res, admin, "Get admin by id successfully");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const updateAdmin = async (req, res) => {
  try {
    const admin = await editAdminService(req.params.id, req.body || {});
    return ApiResponse.success(res, admin, "Admin updated successfully");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const result = await deleteAdminService(req.params.id);
    return ApiResponse.success(res, result, "Admin deleted successfully");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

module.exports = {
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
};
