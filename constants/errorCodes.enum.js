const ErrorCode = {
  // Common
  INTERNAL_SERVER_ERROR: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
  INVALID_KEY: { code: "INVALID_KEY", message: "Error not defined" },
  // Auth or CRUD Accounts
  MISSING_REQUIRED_FIELDS: { code: "MISSING_REQUIRED_FIELDS", message: "Missing required fields" },
  EMAIL_EXISTS: { code: "EMAIL_EXISTS", message: "Email already exists" },
  VALIDATION_ERROR: { code: "VALIDATION_ERROR", message: "Validation failed" },
  ACCOUNT_NOT_FOUND: { code: "ACCOUNT_NOT_FOUND", message: "Account not found" },
  // Admin
  ADMIN_NOT_FOUND: { code: "ADMIN_NOT_FOUND", message: "Admin not found" },
  INVALID_CREDENTIALS: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" },
  
  
  
};

module.exports = ErrorCode;
