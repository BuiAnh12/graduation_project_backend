const ApiResponse = require("../utils/apiResponse");
const ErrorCode = require("../constants/errorCodes.enum");
const { loginService, registerService } = require("../services/auth.service");

// const login = async (req, res, next) => {
//     const { email, password } = req.body;
//     const { getRole, getStore } = req.query;

//     try {
//         const { response, refreshToken } = await loginService({
//             email,
//             password,
//             getRole,
//             getStore,
//         });

//         // set cookie for refresh token
//         res.cookie("refreshToken", refreshToken, {
//             maxAge: 30 * 24 * 60 * 60 * 1000,
//             httpOnly: true,
//         });
//         return ApiResponse.success(res, response, "Login successfully");
//     } catch (err) {
//         return ApiResponse.error(res, err);
//     }
// };
const REFRESH_TOKEN_COOKIE_OPTIONS = {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    // secure: true, // enable in production with HTTPS
    // sameSite: 'strict' // optional
};

const createLoginHandler = (entity) => {
    return async (req, res) => {
        const { email, password } = req.body;

        try {
            const { response, refreshToken } = await loginService({
                entity,
                email,
                password,
            });

            // set cookie
            res.cookie(
                "refreshToken",
                refreshToken,
                REFRESH_TOKEN_COOKIE_OPTIONS
            );

            // success wrapper
            return ApiResponse.success(res, response, "Login successful", 200);
        } catch (err) {
            // err may be an ErrorCode object or custom object with {code,message,status}
            return ApiResponse.error(res, err);
        }
    };
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

const getRefreshToken = async (req, res, next) => {
    try {
        const cookie = req?.cookies;
        if (!cookie?.refreshToken) {
            return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_NOT_FOUND);
        }

        const refreshToken = cookie.refreshToken;
        const { response } = refreshTokenService({ refreshToken });
        return ApiResponse.success(res, response, "Refresh token successfully");
    } catch (err) {
        return ApiResponse.error(res, err);
    }
};



module.exports = {
    loginUser: createLoginHandler("user"),
    loginStaff: createLoginHandler("staff"),
    loginShipper: createLoginHandler("shipper"),
    loginAdmin: createLoginHandler("admin"),
    register,
    getRefreshToken
};
