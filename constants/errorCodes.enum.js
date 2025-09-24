const ErrorCode = {
  // Common
  INTERNAL_SERVER_ERROR: { 
    code: "INTERNAL_SERVER_ERROR", 
    message: "Internal server error", 
    status: 500 
  },
  INVALID_KEY: { 
    code: "INVALID_KEY", 
    message: "Error not defined", 
    status: 400 
  },

  // Auth or CRUD Accounts
  MISSING_REQUIRED_FIELDS: { 
    code: "MISSING_REQUIRED_FIELDS", 
    message: "Missing required fields", 
    status: 400 
  },
  EMAIL_EXISTS: { 
    code: "EMAIL_EXISTS", 
    message: "Email already exists", 
    status: 409 
  },
  VALIDATION_ERROR: { 
    code: "VALIDATION_ERROR", 
    message: "Validation failed", 
    status: 400 
  },
  ACCOUNT_NOT_FOUND: { 
    code: "ACCOUNT_NOT_FOUND", 
    message: "Account not found", 
    status: 404 
  },
  ACCOUNT_ALREADY_EXISTED: { 
    code: "ACCOUNT_ALREADY_EXISTED", 
    message: "Account already existed", 
    status: 409 
  },

  // Admin
  ADMIN_NOT_FOUND: { 
    code: "ADMIN_NOT_FOUND", 
    message: "Admin not found", 
    status: 404 
  },
  INVALID_CREDENTIALS: { 
    code: "INVALID_CREDENTIALS", 
    message: "Invalid credentials", 
    status: 401 
  },
};

module.exports = ErrorCode;
