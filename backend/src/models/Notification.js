const mongoose = require('mongoose');

const NOTIFICATION_TYPES = Object.freeze({
  EXPIRING_SOON: 'EXPIRING_SOON',
  CLAIMED: 'CLAIMED',
  STATUS_UPDATE: 'STATUS_UPDATE',
  URGENT_BROADCAST: 'URGENT_BROADCAST',
  URGENCY_ALERT: 'URGENCY_ALERT',
  DONATION_CLAIMED: 'DONATION_CLAIMED',
  DONATION_CANCELLED: 'DONATION_CANCELLED',
  DONATION_EXPIRED: 'DONATION_EXPIRED',
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
});

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification target userId is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: Object.values(NOTIFICATION_TYPES),
        message: 'Invalid notification type',
      },
      default: NOTIFICATION_TYPES.STATUS_UPDATE,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      default: null,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// TTL Index: Automatically expire notifications after 30 days
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days in seconds
);

// Compound index for querying user notifications sorted by recency
NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
