const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Sanitizes query parameters by rejecting any MongoDB operator keys (e.g., $gt, $ne, $where).
 * Mitigates NoSQL query injection across all endpoints.
 */
const querySanitizer = (req, res, next) => {
  const containsOperator = (obj) => {
    if (!obj) return false;
    if (typeof obj === 'string') {
      return obj.startsWith('$');
    }
    if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        if (key.includes('$') || key.includes('.') || containsOperator(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (req.query && containsOperator(req.query)) {
    return next(
      new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Query parameters cannot contain MongoDB operator keys or forbidden characters'
      )
    );
  }
  next();
};

module.exports = querySanitizer;
