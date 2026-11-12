/**
 * ==============================================================================
 * OWNED BY MEMBER 3 - stub created by Member 2 so Donation.js can import it
 * ==============================================================================
 * Subdocument schema representing a discrete claim/acceptance slice of a donation.
 */

const mongoose = require('mongoose');
const { ACCEPTANCE_STATUS } = require('../constants/status');

const AcceptanceSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
    },
    requirementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecipientRequirement',
      default: null,
    },
    quantity: {
      type: Number,
      required: [true, 'Claimed quantity is required'],
      min: [1, 'Claimed quantity must be at least 1'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(ACCEPTANCE_STATUS),
        message: 'Invalid acceptance status',
      },
      default: ACCEPTANCE_STATUS.CLAIMED,
      required: true,
    },
    pickupPreference: {
      type: String,
      enum: ['self_pickup', 'delivery_agent_required'],
      default: 'self_pickup',
    },
    deliveryAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    handoverVerifiedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

module.exports = AcceptanceSchema;
