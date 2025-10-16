const ErrorCode = {
  // Common
  INTERNAL_SERVER_ERROR: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong, please try again later",
    status: 500,
  },
  INVALID_KEY: {
    code: "INVALID_KEY",
    message: "Invalid key for action",
    status: 400,
  },
  INVALID_REQUEST: {
    code: "INVALID_REQUEST",
    message: "Invalid request",
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
  INVALID_OTP: {
    code: "INVALID_OTP",
    message: "OTP is invalid or expired.",
    status: 400,
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

  // Order
  ORDER_NOT_FOUND: {
    code: "ORDER_NOT_FOUND",
    message: "Order not found",
    status: 404,
  },
  ORDER_STATUS_ALREADY_SET: {
    code: "ORDER_STATUS_ALREADY_SET",
    message: "Order status already setted",
    status: 400,
  },
  INVALID_STATUS_TRANSITION: {
    code: "INVALID_STATUS_TRANSITION",
    message: "Invalid status transaction",
    status: 401,
  },
  ORDER_EMPTY_ITEMS: {
    code: "ORDER_EMPTY_ITEMS",
    message: "Order empty items",
    status: 401,
  },
  ORDER_INVALID_ITEM: {
    code: "ORDER_INVALID_ITEM",
    message: "Order invalid items",
    status: 401,
  },
  ORDER_HAS_OUT_OF_STOCK: {
    code: "ORDER_HAS_OUT_OF_STOCK",
    message: "Order item has out of stock",
    status: 401,
  },
  ORDER_CANCEL_UNAUTHORIZED: {
    statusCode: 403,
    message: "You are not authorized to cancel this order",
    code: "ORDER_CANCEL_UNAUTHORIZED",
  },
  ORDER_CANNOT_CANCEL_STATUS: {
    statusCode: 409,
    message:
      "This order cannot be cancelled because its status does not allow it",
    code: "ORDER_CANNOT_CANCEL_STATUS",
  },

  // Dish
  DISH_NOT_FOUND: {
    code: "DISH_NOT_FOUND",
    message: "Dish not found",
    status: 404,
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

  // Payment
  INVALID_SIGNATURE: {
    code: "INVALID_SIGNATURE",
    message: "Invalid signature",
    status: 400,
  },

  // User
  USER_NOT_FOUND: {
    code: "USER_NOT_FOUND",
    message: "User not found",
    status: 404,
  },

  // STORE
  STORE_NOT_FOUND: {
    code: "STORE_NOT_FOUND",
    message: "Store not found",
    status: 404,
  },

  STORE_PENDING: {
    code: "STORE_PENDING",
    message: "Store is waiting for approval",
    status: 403,
  },

  STORE_BLOCKED: {
    code: "STORE_BLOCKED",
    message: "Store has been blocked",
    status: 403,
  },
  STORE_NOT_FOUND_FOR_USER: {
    code: "STORE_NOT_FOUND_FOR_USER",
    message: "User does not have a store",
    status: 404,
  },
  INVALID_STORE_STATUS: {
    code: "INVALID_STORE_STATUS",
    message: "Invalid status. Must be one of: approved, register, blocked.",
    status: 400,
  },
  INVALID_STORE_STATUS: {
    code: "INVALID_STORE_STATUS",
    message: "Invalid status. Must be one of: approved, register, blocked.",
    status: 400,
  },
  INVALID_STATUS_TO_CHANGE: {
    code: "INVALID_STATUS_TO_CHANGE",
    message: "Invalid status",
    status: 400,
  },

  // STAFF
  STAFF_NOT_FOUND: {
    code: "STAFF_NOT_FOUND",
    message: "Staff not found",
    status: 404,
  },
  // VOUCHER
  VOUCHER_NOT_FOUND: {
    code: "VOUCHER_NOT_FOUND",
    message: "Voucher not found",
    status: 404,
  },

  VOUCHER_CODE_EXISTS: {
    code: "VOUCHER_CODE_EXISTS",
    message: "Voucher is existed",
    status: 400,
  },

  // UPLOAD FILE
  NO_FILE_UPLOADED: {
    code: "NO_FILE_UPLOADED",
    message: "No file uploaded",
    status: 400,
  },
  NO_FILES_UPLOADED: {
    code: "NO_FILES_UPLOADED",
    message: "No files uploaded",
    status: 400,
  },
  FILE_DELETE_FAILED: {
    code: "FILE_DELETE_FAILED",
    message: "File delete failed",
    status: 400,
  },
  FILE_NOT_FOUND: {
    code: "FILE_NOT_FOUND",
    message: "File not found",
    status: 404,
  },

  // Favorite
  FAVORITE_NOT_FOUND: {
    code: "FAVORITE_NOT_FOUND",
    message: "Favorite list not found",
    status: 404,
  },
  STORE_ALREADY_IN_FAVORITE: {
    code: "STORE_ALREADY_IN_FAVORITE",
    message: "Store is already in favorites",
    status: 400,
  },
  // Rating
  RATING_NOT_FOUND: {
    code: "RATING_NOT_FOUND",
    message: "Rating not found",
    status: 404,
  },
  ALREADY_RATED: {
    code: "ALREADY_RATED",
    message: "You have already rated this order",
    status: 400,
  },
  INVALID_RATING_VALUE: {
    code: "INVALID_RATING_VALUE",
    message: "Rating value must be between 1 and 5",
    status: 400,
  },
  RATING_CONTENT_REQUIRED: {
    code: "RATING_CONTENT_REQUIRED",
    message: "Comment or image is required",
    status: 400,
  },
  INVALID_REPLY: {
    code: "INVALID_REPLY",
    message: "Reply must be a string",
    status: 400,
  },
  SYSTEM_CATEGORY_NOT_FOUND: {
    status: 404,
    message: "Loại thức ăn không tồn tại",
    code: "SYSTEM_CATEGORY_NOT_FOUND",
  },
  SYSTEM_CATEGORY_ALREADY_EXISTS: {
    status: 409,
    message: "Loại thức ăn đã tồn tại",
    code: "SYSTEM_CATEGORY_ALREADY_EXISTS",
  },
  INVALID_SYSTEM_CATEGORY_NAME: {
    status: 400,
    message: "Tên loại thức ăn không hợp lệ",
    code: "INVALID_SYSTEM_CATEGORY_NAME",
  },
  INVALID_SYSTEM_CATEGORY_IMAGE: {
    status: 400,
    message: "Ảnh loại thức ăn không hợp lệ",
    code: "INVALID_SYSTEM_CATEGORY_IMAGE",
  },
  CAN_NOT_DELETE_SYSTEM_CATEGORY: {
    status: 400,
    message: "Không thể xóa danh mục này",
    code: "CAN_NOT_DELETE_SYSTEM_CATEGORY",
  },

  // Notification
  NOTIFICATION_NOT_FOUND: {
    statusCode: 404,
    message: "Notification not found",
    code: "NOTIFICATION_NOT_FOUND",
  },

  LOCATION_NOT_FOUND: {
    statusCode: 404,
    message: "Location not found",
    code: "LOCATION_NOT_FOUND",
  },
  LOCATION_DUPLICATE_TYPE: {
    statusCode: 400,
    message: "You can only have one location of this type (home or company)",
    code: "LOCATION_DUPLICATE_TYPE",
  },
  LOCATION_USER_REQUIRED: {
    statusCode: 400,
    message: "User ID is required",
    code: "LOCATION_USER_REQUIRED",
  },

  // SHIPPING FEE
  FEE_TOO_HIGH: {
    statusCode: 400,
    message: "Mức phí quá cao",
    code: "FEE_TOO_HIGH",
  },
  DUPLICATE_FROM_DISTANCE: {
    statusCode: 400,
    message: "Mức phí đã tồn tại",
    code: "DUPLICATE_FROM_DISTANCE",
  },
  SHIPPING_FEE_NOT_FOUND: {
    statusCode: 404,
    message: "Không tìm thấy mức phí",
    code: "SHIPPING_FEE_NOT_FOUND",
  },
  CANNOT_DELETE_ZERO_STEP: {
    statusCode: 400,
    message: "Không thể xóa giá trị 0",
    code: "CANNOT_DELETE_ZERO_STEP",
  },

  // CATEGORY
  CATEGORY_NOT_FOUND: {
    statusCode: 404,
    message: "Không tìm thấy loại này",
    code: "CATEGORY_NOT_FOUND",
  },
  INVALID_CATEGORY_NAME: {
    statusCode: 400,
    message: "Tên không hợp lệ",
    code: "INVALID_CATEGORY_NAME",
  },
  INVALID_STORE_ID: {
    statusCode: 404,
    message: "Không thấy mã danh mục hay không hợp lệ",
    code: "INVALID_STORE_ID",
  },
  CATEGORY_ALREADY_EXISTS: {
    statusCode: 400,
    message: "Tên danh mục đã tồn tại",
    code: "CATEGORY_ALREADY_EXISTS",
  },
  CATEGORY_IN_USE: {
    statusCode: 400,
    message: "Danh mục có món ăn",
    code: "CATEGORY_IN_USE",
  },

  // TOPPING GROUP
  TOPPING_GROUP_NOT_FOUND: {
    statusCode: 404,
    message: "Không tìm thấy nhóm topping này",
    code: "TOPPING_GROUP_NOT_FOUND",
  },
  INVALID_TOPPING_GROUP: {
    statusCode: 400,
    message: "Nhóm topping không hợp lệ",
    code: "INVALID_TOPPING_GROUP",
  },
  TOPPING_GROUP_ALREADY_EXISTS: {
    statusCode: 400,
    message: "Nhóm topping đã tồn tại",
    code: "TOPPING_GROUP_ALREADY_EXISTS",
  },
  CAN_NOT_DELETE_TOPPING_GROUP: {
    statusCode: 400,
    message: "Có thể có topping trong nhóm này hoặc lỗi",
    code: "CAN_NOT_DELETE_TOPPING_GROUP",
  },

  // TOPPING
  TOPPING_NOT_FOUND: {
    statusCode: 404,
    message: "Không tìm thấy topping này",
    code: "TOPPING_NOT_FOUND",
  },
  INVALID_TOPPING: {
    statusCode: 400,
    message: "Topping không hợp lệ",
    code: "INVALID_TOPPING",
  },

  AI_IMAGE_REQUIRED: {
    statusCode: 400,
    message: "Image is required for prediction.",
  },
  AI_SERVER_CONNECTION_FAILED: {
    statusCode: 500,
    message: "Failed to connect to AI server.",
  },
  AI_PREDICTION_FAILED: {
    statusCode: 500,
    message: "Failed to generate tag predictions.",
  },
  AI_RECOMMENDATION_FAILED: {
    statusCode: 500,
    message: "Failed to generate dish recommendations.",
  },
  AI_SIMILAR_DISH_FAILED: {
    statusCode: 500,
    message: "Failed to find similar dishes.",
  },
  AI_BEHAVIOR_TEST_FAILED: {
    statusCode: 500,
    message: "Failed to process behavior test request.",
  },
};

module.exports = ErrorCode;
