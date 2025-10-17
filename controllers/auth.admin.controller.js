const {
  getProfileService,
  updateProfileService,
  checkCurrentPasswordService,
  updatePasswordService,
} = require("../services/auth.admin.service");
const ApiResponse = require("../utils/apiResponse");
const ErrorCode = require("../constants/errorCodes.enum");

const getProfile = async (req, res) => {
  try {
    const result = await getProfileService(req.user?._id);
    return ApiResponse.success(res, result, "Get profile successfully");
  } catch (error) {
    return ApiResponse.error(
      res,
      error || ErrorCode.INTERNAL_SERVER_ERROR,
      error?.message || "Server Error"
    );
  }
};

const updateProfileInfo = async (req, res) => {
  try {
    const result = await updateProfileService(req.user?._id, req.body);
    return ApiResponse.success(res, result, "Update profile successfully");
  } catch (error) {
    return ApiResponse.error(
      res,
      error || ErrorCode.INTERNAL_SERVER_ERROR,
      error?.message || "Server Error"
    );
  }
};

const checkCurrentPassword = async (req, res) => {
  try {
    const result = await checkCurrentPasswordService(
      req.user?._id,
      req.body.currentPassword
    );
    return ApiResponse.success(res, result, "Check password successfully");
  } catch (error) {
    return ApiResponse.error(
      res,
      error || ErrorCode.INTERNAL_SERVER_ERROR,
      error?.message || "Server Error"
    );
  }
};
const resetPassword = async (req, res) => {
  try {
    const result = await updatePasswordService(req.user?._id, req.body);
    return ApiResponse.success(res, result, "Reset password successfully");
  } catch (error) {
    return ApiResponse.error(
      res,
      error || ErrorCode.INTERNAL_SERVER_ERROR,
      error?.message || "Server Error"
    );
  }
};
module.exports = {
  getProfile,
  updateProfileInfo,
  checkCurrentPassword,
  resetPassword,
};
