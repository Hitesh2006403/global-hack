const Notification = require('../models/Notification');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/v1/notifications
 * Retrieves paginated in-app notifications for the authenticated user.
 * Supports filtering by unread status (?unread=true).
 */
const getMyNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id };

  if (req.query.unread === 'true') {
    filter.readAt = null;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user._id, readAt: null }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return ApiResponse.send(res, 200, 'Notifications retrieved successfully', {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a single notification as read.
 * Strict IDOR protection: Users can ONLY mark their own notifications as read.
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);

  if (!notification) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Notification with ID '${id}' not found`);
  }

  // IDOR Defense: Forbid modifying another user's notification
  if (notification.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      ERROR_CODES.FORBIDDEN,
      'You are not authorized to modify this notification'
    );
  }

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }

  return ApiResponse.send(res, 200, 'Notification marked as read', {
    notification,
  });
});

/**
 * PATCH /api/v1/notifications/read-all
 * Marks all unread notifications for the authenticated user as read.
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const now = new Date();
  const result = await Notification.updateMany(
    { userId: req.user._id, readAt: null },
    { $set: { readAt: now } }
  );

  return ApiResponse.send(res, 200, 'All unread notifications marked as read', {
    markedReadCount: result.modifiedCount,
  });
});

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
