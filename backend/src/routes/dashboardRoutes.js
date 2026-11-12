const express = require('express');
const rateLimit = require('express-rate-limit');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const requireVerified = require('../middlewares/verificationMiddleware');
const { ROLES } = require('../constants/roles');
const ERROR_CODES = require('../constants/errorCodes');

const router = express.Router();

// Rate limiter for public impact endpoint (relaxed in test environment)
const impactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 100, // 100 req per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED || 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests to public impact dashboard, please try again later.',
    },
  },
});

/**
 * GET /api/v1/dashboard/impact
 * Public platform-level impact statistics (no authentication required).
 * Rate-limited and cached.
 */
router.get('/impact', impactLimiter, dashboardController.getPublicImpact);

/**
 * GET /api/v1/dashboard/donor
 * Donor analytics dashboard (donor only).
 */
router.get(
  '/donor',
  protect,
  authorizeRoles(ROLES.DONOR, ROLES.ADMIN),
  dashboardController.getDonorDashboard
);

/**
 * GET /api/v1/dashboard/recipient
 * Recipient demand & claim dashboard (verified recipient only).
 */
router.get(
  '/recipient',
  protect,
  authorizeRoles(ROLES.RECIPIENT, ROLES.ADMIN),
  requireVerified,
  dashboardController.getRecipientDashboard
);

module.exports = router;
