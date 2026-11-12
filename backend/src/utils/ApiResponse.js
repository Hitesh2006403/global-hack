class ApiResponse {
  constructor(statusCode, message = 'Success', data = null, meta = null) {
    this.success = statusCode < 400;
    this.message = message;
    if (data !== null && data !== undefined) {
      this.data = data;
    }
    if (meta !== null && meta !== undefined) {
      this.meta = meta;
    }
  }

  static send(res, statusCode, message = 'Success', data = null, meta = null) {
    const response = new ApiResponse(statusCode, message, data, meta);
    return res.status(statusCode).json(response);
  }
}

module.exports = ApiResponse;
