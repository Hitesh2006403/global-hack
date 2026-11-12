const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    donationId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    stage: {
      type: String,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.Mixed,
      default: 'anonymous',
    },
    userRole: {
      type: String,
      default: 'guest',
    },
    ip: {
      type: String,
      default: '127.0.0.1',
    },
    success: {
      type: Boolean,
      default: true,
    },
    reason: {
      type: String,
      default: 'Operation authorized and verified',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to retain logs for 90 days
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

module.exports = AuditLog;
