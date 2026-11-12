const mongoose = require('mongoose');

const VOICE_CALL_STATUS = Object.freeze({
  INITIATED: 'INITIATED',
  RINGING: 'RINGING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

/**
 * Masks a phone number to protect PII.
 * Example: +919876543210 -> +91******3210
 */
const maskPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (trimmed.length <= 6) return '******';
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}${'*'.repeat(Math.max(trimmed.length - 7, 4))}${suffix}`;
};

const VoiceCallSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    recipientPhone: {
      type: String,
      required: true,
      set: maskPhoneNumber, // Automatically masks full phone number before saving
    },
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: [true, 'Donation ID is required for AI voice dispatch'],
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(VOICE_CALL_STATUS),
        message: 'Invalid voice call status',
      },
      default: VOICE_CALL_STATUS.INITIATED,
      required: true,
    },
    transcript: {
      type: String,
      default: 'Hello, this is an automated dispatch from Share A Plate regarding urgent food pickup.',
      trim: true,
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

module.exports = mongoose.model('VoiceCall', VoiceCallSchema);
module.exports.VOICE_CALL_STATUS = VOICE_CALL_STATUS;
module.exports.maskPhoneNumber = maskPhoneNumber;
