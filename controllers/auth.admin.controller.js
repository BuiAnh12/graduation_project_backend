const { loginAdminService } = require("../services/auth.admin.service");
const ApiResponse = require("../utils/apiResponse");
const ErrorCode = require("../constants/errorCodes.enum");

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginAdminService(email, password);
    return ApiResponse.success(res, result, "Login successful");
  } catch (error) {
      return ApiResponse.error(res, error);
  }
};

module.exports = { loginAdmin };