const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { ROLES } = require('../constants/roles');

/**
 * Middleware requiring account verification for sensitive roles.
 * Blocks unverified recipients and delivery agents from performing sensitive domain operations.
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
  }

  // Recipients and delivery agents must be verified by an administrator
  if ([ROLES.RECIPIENT, ROLES.DELIVERY_AGENT].includes(req.user.role) && !req.user.isVerified) {
    return next(
      new ApiError(
        403,
        ERROR_CODES.UNVERIFIED_ACCOUNT,
        'Account verification required: Your account is pending administrator approval before you can perform this action'
      )
    );
  }

  next();
};

module.exports = requireVerified;
