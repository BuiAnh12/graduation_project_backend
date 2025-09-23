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

  static error(res, errorCodeObj, statusCode = 500, message = null, meta = {}) {
    return res.status(statusCode).json({
      success: false,
      message: message || errorCodeObj.message,
      errorCode: errorCodeObj.code,
      errorMessage: errorCodeObj.message,
      meta: {
        status: statusCode,
        ...meta,
      },
    });
  }
}

module.exports = ApiResponse;
