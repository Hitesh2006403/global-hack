const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Role-based access control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 *
 * @param {...string} allowedRoles - List of permitted roles
 * @returns {Function} Express middleware
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          ERROR_CODES.FORBIDDEN,
          `Access forbidden: Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};

module.exports = authorizeRoles;
