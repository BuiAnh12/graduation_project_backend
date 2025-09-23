const { loginAdminService } = require("../services/auth.admin.service");
const ApiResponse = require("../utils/apiResponse");
const ErrorCode = require("../constants/errorCodes.enum");

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginAdminService(email, password);
    return ApiResponse.success(res, result, "Login successful");
  } catch (error) {
    // Nếu lỗi là ErrorCode object thì trả về đúng nó
    if (error && error.code && error.message) {
      return ApiResponse.error(res, error, 400);
    }

    // Nếu là lỗi thường (chưa define trong ErrorCode)
    return ApiResponse.error(res, ErrorCode.INVALID_KEY, 400, error.message || "Unknown error");
  }
};

module.exports = { loginAdmin };