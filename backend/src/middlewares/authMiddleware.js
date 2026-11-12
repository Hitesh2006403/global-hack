const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const authService = require('../services/authService');
const User = require('../models/User');

/**
 * Protects routes by validating JWT Bearer tokens and loading the live user from the DB.
 * SECURITY: Never trusts the role from the token alone. Checks isActive on every request.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication token is required');
    }

    let decoded;
    try {
      decoded = authService.verifyToken(token);
    } catch (err) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid or expired authentication token');
    }

    if (!decoded || !decoded.id) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Malformed authentication token payload');
    }

    // Always fetch fresh user record from the database to check role and activation status
    const user = await User.findById(decoded.id).select('+isActive');

    if (!user) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'User belonging to this token no longer exists');
    }

    if (!user.isActive) {
      throw new ApiError(
        403,
        ERROR_CODES.DEACTIVATED_ACCOUNT,
        'This account has been deactivated. Access is denied.'
      );
    }

    // Attach fresh user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect,
};
