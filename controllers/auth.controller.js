const ApiResponse = require("../utils/apiResponse");
const ErrorCode = require("../constants/errorCodes.enum")
const { loginService, registerService } = require("../services/auth.service");

const login = async (req, res, next) => {
    const { email, password } = req.body;
    const { getRole, getStore } = req.query;

    try {
        const { response, refreshToken } = await loginService({
            email,
            password,
            getRole,
            getStore,
        });

        // set cookie for refresh token
        res.cookie("refreshToken", refreshToken, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
        });
        return ApiResponse.success(res, response, "Login successfully");
    } catch (err) {
        return ApiResponse.error(res, err);
    }
};

const register = async (req, res, next) => {
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

module.exports = {
    login,
    register,
};
