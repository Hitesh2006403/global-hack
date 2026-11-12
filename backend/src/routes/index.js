const express = require('express');
const ApiResponse = require('../utils/ApiResponse');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const donationRoutes = require('./donationRoutes');
const requirementRoutes = require('./requirementRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const notificationRoutes = require('./notificationRoutes');
const handoverRoutes = require('./handoverRoutes');

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    System health and liveness check
 * @access  Public
 */
router.get('/health', (req, res) => {
  return ApiResponse.send(res, 200, 'System operational', {
    status: 'UP',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route   GET /api/v1/meta
 * @desc    System metadata and enumerations for frontend clients (no hardcoded enums)
 * @access  Public
 */
const { ROLES } = require('../constants/roles');
const {
  DONATION_STATUS,
  ACCEPTANCE_STATUS,
  REQUIREMENT_STATUS,
} = require('../constants/status');

router.get('/meta', (req, res) => {
  return ApiResponse.send(res, 200, 'System metadata and enumerations retrieved', {
    roles: Object.values(ROLES),
    donationStatuses: Object.values(DONATION_STATUS),
    acceptanceStatuses: Object.values(ACCEPTANCE_STATUS),
    requirementStatuses: Object.values(REQUIREMENT_STATUS),
    foodTypes: ['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items'],
    units: ['plates', 'kg', 'packets', 'servings'],
    dietaryTypes: ['vegetarian', 'non_vegetarian', 'vegan', 'any'],
    urgencyLevels: ['NORMAL', 'URGENT', 'CRITICAL', 'EXPIRED'],
    defaultSafetyBufferMinutes: Number(process.env.SAFETY_BUFFER_MINUTES_DEFAULT || 60),
  });
});

// Authentication and session routes (/api/v1/auth)
router.use('/auth', authRoutes);

// Administrator management routes (/api/v1/admin)
router.use('/admin', adminRoutes);

// Surplus food donation routes (/api/v1/donations)
router.use('/donations', donationRoutes);

// Recipient requirements / demand routes (/api/v1/requirements)
router.use('/requirements', requirementRoutes);

// Dashboards and platform analytics (/api/v1/dashboard)
router.use('/dashboard', dashboardRoutes);

// In-app notifications and automated voice calls (/api/v1/notifications)
router.use('/notifications', notificationRoutes);

// Secure QR Code Handover System (/api/v1/handover)
router.use('/handover', handoverRoutes);

// Test harness verification route (active strictly in test environment)
if (process.env.NODE_ENV === 'test') {
  const { protect } = require('../middlewares/authMiddleware');
  const requireVerified = require('../middlewares/verificationMiddleware');
  router.get('/test-verified-action', protect, requireVerified, (req, res) => {
    res.status(200).json({ success: true, message: 'Action allowed for verified account' });
  });
}

module.exports = router;
