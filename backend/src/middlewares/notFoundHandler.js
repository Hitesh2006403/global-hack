const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Catches unhandled routes and forwards a 404 ApiError to the global errorHandler.
 */
const notFoundHandler = (req, res, next) => {
  next(
    new ApiError(
      404,
      ERROR_CODES.NOT_FOUND,
      `Cannot ${req.method} ${req.originalUrl}`
    )
  );
};

module.exports = notFoundHandler;
