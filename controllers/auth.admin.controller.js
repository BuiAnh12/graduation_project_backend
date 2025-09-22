const { loginAdminService } = require("../services/auth.admin.service");
const ApiResponse = require("../utils/apiResponse");

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return ApiResponse.error(res, 400, "Email and password are required");
    }

    const result = await loginAdminService(email, password);

    return ApiResponse.success(res, 200, "Login successful", result);
  } catch (err) {
    return ApiResponse.error(res, 401, err.message || "Login failed");
  }
};

module.exports = { loginAdmin };
