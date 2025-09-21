const ApiResponse = require("../utils/apiResponse");
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
        return ApiResponse.success(res, 200, "Login successfully", response);
    } catch (err) {
        return ApiResponse.error(res, err.status, err.message);
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
        return ApiResponse.success(res, 200, "Register successfully", response);
    } catch (err) {
        return ApiResponse.error(res, err.status, err.message);
    }
};

module.exports = {
    login,
    register,
};
