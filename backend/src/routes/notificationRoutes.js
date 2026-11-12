const express = require('express');
const notificationController = require('../controllers/notificationController');
const voiceCallController = require('../controllers/voiceCallController');
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// All notification operations require authentication
router.use(protect);

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all unread notifications as read.
 * Declared before /:id/read to prevent route collision.
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * POST /api/v1/notifications/ai-call/trigger
 * Dispatches an automated urgent voice call (Admin only).
 */
router.post(
  '/ai-call/trigger',
  authorizeRoles(ROLES.ADMIN),
  voiceCallController.triggerAiCall
);

/**
 * GET /api/v1/notifications/ai-call/:id
 * Retrieves status and audit record of an AI voice call (Admin or target user).
 */
router.get('/ai-call/:id', voiceCallController.getAiCallStatus);

/**
 * GET /api/v1/notifications
 * List notifications for the authenticated user.
 */
router.get('/', notificationController.getMyNotifications);

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;
