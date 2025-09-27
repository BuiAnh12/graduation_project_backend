const ErrorCode = require("../constants/errorCodes.enum");
class ApiResponse {
  static success(
    res,
    data = null,
    message = "Success",
    statusCode = 200,
    meta = {}
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta: {
        status: statusCode,
        ...meta,
      },
    });
  }

  static error(res, errorCodeObj, message = null, meta = {}) {
    if (!(errorCodeObj && errorCodeObj.code && errorCodeObj.message && errorCodeObj.status)) { // If it was not normal Error Object
      console.log(errorCodeObj)
      errorCodeObj = ErrorCode.INTERNAL_SERVER_ERROR // Set as default internal_server_error
    }
    return res.status(errorCodeObj.status).json({
      success: false,
      message: message,
      errorCode: errorCodeObj.code,
      errorMessage: errorCodeObj.message,
      meta: {
        status: errorCodeObj.status,
        ...meta,
      },
    });
  }
}

module.exports = ApiResponse;
