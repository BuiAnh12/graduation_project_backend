class ApiResponse {
  static success(res, statusCode = 200, message = "Success", data = null) {
    return res.status(statusCode).json({
      status: statusCode,
      message,
      data,
    });
  }

  static error(res, statusCode = 500, message = "Internal Server Error") {
    return res.status(statusCode).json({
      status: statusCode,
      message,
    });
  }
}

module.exports = ApiResponse;
