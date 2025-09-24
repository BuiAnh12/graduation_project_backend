const ErrorCode = {
    // Common
    INTERNAL_SERVER_ERROR: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        status: 500,
    },
    INVALID_KEY: {
        code: "INVALID_KEY",
        message: "Invalid key for action",
        status: 400,
    },

    // Auth or CRUD Accounts
    MISSING_REQUIRED_FIELDS: {
        code: "MISSING_REQUIRED_FIELDS",
        message: "Missing required fields",
        status: 400,
    },
    EMAIL_EXISTS: {
        code: "EMAIL_EXISTS",
        message: "Email already exists",
        status: 409,
    },
    VALIDATION_ERROR: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        status: 400,
    },
    ACCOUNT_NOT_FOUND: {
        code: "ACCOUNT_NOT_FOUND",
        message: "Account not found",
        status: 404,
    },
    ACCOUNT_ALREADY_EXISTED: {
        code: "ACCOUNT_ALREADY_EXISTED",
        message: "Account already existed",
        status: 409,
    },
    ACCESS_TOKEN_NOT_FOUND: {
        code: "ACCESS_TOKEN_NOT_FOUND",
        message: "No refresh token in cookies",
        status: 404,
    },
    ACCESS_TOKEN_EXPIRED: {
        code: "ACCESS_TOKEN_EXPIRED",
        message: "Token expired, Please login again!",
        status: 401,
    },
    INVALID_REFRESH_TOKEN: {
        code: "INVALID_REFRESH_TOKEN",
        message: "No refresh token present in database or not matched",
        status: 404,
    },
    REFRESH_TOKEN_EXPIRE: {
        code: "REFRESH_TOKEN_EXPIRE",
        message: "Token expired, Please login again!",
        status: 401,
    },
    ENTITY_NOT_SUPPORTED: {
        code: "ENTITY_NOT_SUPPORTED",
        message: "Login entity not supported",
        status: 400,
    },
    ENTITY_NOT_FOUND: {
        code: "ENTITY_NOT_FOUND",
        message: "Entity not found",
        status: 404,
    },

    // Cart
    CART_NOT_FOUND: {
        code: "CART_NOT_FOUND",
        message: "Cart not found",
        status: 404,
    },
    CART_EMPTY: {
        code: "CART_EMPTY",
        message: "Cart is empty",
        status: 400,
    },
    NOT_ENOUGH_STOCK: {
        code: "NOT_ENOUGH_STOCK",
        message: "Not enough stock",
        status: 400,
    },
    VOUCHER_INVALID: {
        code: "VOUCHER_INVALID",
        message: "Invalid or expired voucher",
        status: 400,
    },
    USER_CART_MISSMATCH: {
        code: "USER_CART_MISSMATCH",
        message: "Invalid user for this cart",
        status: 400,
    },
    ALREADY_IN_CART: {
        code: "ALREADY_IN_CART",
        message: "Participant already in cart",
        status: 400,
    },
    NOT_PARTICIPANT: {
        code: "NOT_PARTICIPANT",
        message: "Not a participant of the cart",
        status: 400,
    },

    // Admin
    ADMIN_NOT_FOUND: {
        code: "ADMIN_NOT_FOUND",
        message: "Admin not found",
        status: 404,
    },
    INVALID_CREDENTIALS: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid credentials",
        status: 401,
    },
};

module.exports = ErrorCode;
