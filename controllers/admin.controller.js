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
    // Nếu lỗi là ErrorCode object thì trả về đúng nó
    if (error && error.code && error.message) {
      return ApiResponse.error(res, error, 400);
    }

    // Nếu là lỗi thường (chưa define trong ErrorCode)
    return ApiResponse.error(
      res,
      ErrorCode.INVALID_KEY,
      400,
      error.message || "Unknown error"
    );
  }
};

const getAllAdmins = async (req, res) => {
  try {
    const admins = await getAllAdService();
    return ApiResponse.success(res, admins, "Get all admins successfully");
  } catch (error) {
    return ApiResponse.error(res, ErrorCode.INVALID_KEY, 400, error.message);
  }
};

const getAdminById = async (req, res) => {
  try {
    const admin = await getAdminByIdService(req.params.id);
    return ApiResponse.success(res, admin, "Get admin by id successfully");
  } catch (error) {
    return ApiResponse.error(res, ErrorCode.INVALID_KEY, 400, error.message);
  }
};

const updateAdmin = async (req, res) => {
  try {
    const admin = await editAdminService(req.params.id, req.body || {});
    return ApiResponse.success(res, admin, "Admin updated successfully");
  } catch (error) {
    return ApiResponse.error(res, ErrorCode.INVALID_KEY, 400, error.message);
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const result = await deleteAdminService(req.params.id);
    return ApiResponse.success(res, result, "Admin deleted successfully");
  } catch (error) {
    return ApiResponse.error(res, ErrorCode.INVALID_KEY, 400, error.message);
  }
};

module.exports = {
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
};
