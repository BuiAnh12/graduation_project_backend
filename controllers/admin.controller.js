const ErrorCode = require("../constants/errorCodes.enum");
const {
  createAccountService,
  getAllAdService,
  getAdminByIdService,
  editAdminService,
  deleteAdminService,
  toggleAdminAccountStatusService
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
    const { admin, meta } = await getAllAdService(req.user?._id, req.query);
    return ApiResponse.success(
      res,
      admin,
      "Admin fetched successfully",
      200,
      meta
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
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

const toggleAccoutAdminStatus = async (req, res) => {
  try {
    const result = await toggleAdminAccountStatusService(req.params.adminId);
    return ApiResponse.success(
      res,
      null,
      "Admin change status successfully",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

module.exports = {
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  toggleAccoutAdminStatus,
};
