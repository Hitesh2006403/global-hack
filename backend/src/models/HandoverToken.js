const mongoose = require('mongoose');

const HandoverTokenSchema = new mongoose.Schema(
  {
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      index: true,
    },
    acceptanceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    stage: {
      type: String,
      enum: ['PICKUP', 'RECEIPT'],
      required: true,
      index: true,
    },
    rawToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    signature: {
      type: String,
      required: true,
    },
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'USED', 'EXPIRED', 'REVOKED'],
      default: 'ACTIVE',
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    usedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    usedByRole: {
      type: String,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revocationReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically prune very old tokens after 30 days
HandoverTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

const HandoverToken = mongoose.model('HandoverToken', HandoverTokenSchema);

module.exports = HandoverToken;
