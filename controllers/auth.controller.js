const ApiResponse = require("../utils/apiResponse");
const ErrorCode = require("../constants/errorCodes.enum");
const {
  registerService,
  loginService,
  // googleLoginService,
  refreshTokenService,
  logoutService,
  changePasswordService,
  forgotPasswordService,
  checkOTPService,
  refreshTokenAdminService,
} = require("../services/auth.service");

const {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  verifyOtp,
} = require("../services/auth.user.service");

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
};
/**
 * Factory login handler for different entities
 */
const createLoginHandler = (entity) => {
  return async (req, res) => {
    const { email, password } = req.body;

    try {
      const { response, refreshToken } = await loginService({
        entity,
        email,
        password,
      });

      // Set refresh token vào cookie
      res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      return ApiResponse.success(res, response, "Login successful", 200);
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
};

const register = async (req, res) => {
  const { name, email, phonenumber, gender, password } = req.body;
  try {
    const { response } = await registerService({
      name,
      email,
      phonenumber,
      gender,
      password,
    });
    return ApiResponse.success(res, response, "Register successfully", 201);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const createRefreshTokenHandler = (entity) => {
  return async (req, res) => {
    try {
      const cookie = req?.cookies;
      if (!cookie?.refreshToken) {
        return ApiResponse.error(res, ErrorCode.REFRESH_TOKEN_NOT_FOUND);
      }

      const refreshToken = cookie.refreshToken;

      const { response } = await refreshTokenService({
        refreshToken,
        entity,
      });

      // Nếu muốn set lại cookie (tùy bạn có muốn refresh lại cookie hay không)
      res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      return ApiResponse.success(
        res,
        response,
        "Refresh token successful",
        200
      );
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
};

const refreshTokenShipper = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return ApiResponse.error(res, ErrorCode.REFRESH_TOKEN_NOT_FOUND);
    }

    const { response, newRefreshToken } = await refreshTokenService({
      refreshToken,
      entity: "shipper",
    });

    return ApiResponse.success(
      res,
      {
        ...response,
        refreshToken: newRefreshToken,
      },
      "Refresh token successful",
      200
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

// Wrappers for user-specific auth services
// const googleLogin = async (req, res) => {
//   try {
//     const { token } = req.body;
//     const data = await googleLoginService(token);
//     return ApiResponse.success(res, data, "Google login successful");
//   } catch (err) {
//     return ApiResponse.error(res, err);
//   }
// };

const logout = async (req, res) => {
  try {
    const cookie = req?.cookies;
    await logoutService(cookie?.refreshToken);
    res.clearCookie("refreshToken", REFRESH_TOKEN_COOKIE_OPTIONS);
    return ApiResponse.success(res, null, "Logout successful");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const changePassword = async (req, res) => {
  try {
    const data = await changePasswordService(
      req.user._id,
      req.body.oldPassword,
      req.body.newPassword
    );
    return ApiResponse.success(res, data, "Password changed successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

// const resetPassword = async (req, res) => {
//   try {
//     const data = await resetPasswordService(req.body.email, req.body.newPassword);
//     return ApiResponse.success(res, data, "Password reset successfully");
//   } catch (err) {
//     return ApiResponse.error(res, err);
//   }
// };

const checkOTP = async (req, res) => {
  try {
    const data = await checkOTPService(req.body.email, req.body.otp);
    return ApiResponse.success(res, data, "OTP valid");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

// const storeOwnByUser = async (req, res) => {
//   try {
//     const data = await storeOwnByUserService(req.user._id);
//     return ApiResponse.success(res, data, "Store fetched successfully");
//   } catch (err) {
//     return ApiResponse.error(res, err);
//   }
// };

const checkRegisterStoreOwner = async (req, res) => {
  try {
    const data = await checkRegisterStoreOwnerService(req.params.email);
    return ApiResponse.success(res, data, "Check store owner success");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

module.exports = {
  loginUser: createLoginHandler("user"),
  loginStaff: createLoginHandler("staff"),
  loginShipper: createLoginHandler("shipper"),
  loginAdmin: createLoginHandler("admin"),
  refreshTokenUser: createRefreshTokenHandler("user"),
  refreshTokenStaff: createRefreshTokenHandler("staff"),
  refreshTokenShipper,
  refreshTokenAdmin: createRefreshTokenHandler("admin"),
  register,
  // googleLogin,
  logout,
  changePassword,
  // resetPassword,
  forgotPassword,
  checkOTP,
  // storeOwnByUser,
  checkRegisterStoreOwner,
};
