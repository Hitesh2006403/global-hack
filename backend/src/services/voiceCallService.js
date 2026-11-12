const crypto = require('crypto');
const VoiceCall = require('../models/VoiceCall');
const { VOICE_CALL_STATUS, maskPhoneNumber } = require('../models/VoiceCall');
const Donation = require('../models/Donation');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * AI Voice Call Provider Interface.
 * Current Implementation: Mock Telephony Provider (Sandbox / Hackathon Stub).
 */
class MockVoiceCallProvider {
  /**
   * Simulates calling a recipient for urgent donations.
   *
   * @param {Object} params
   * @param {string} params.donationId
   * @param {string} params.recipientPhone
   * @param {string} [params.recipientId]
   * @returns {Promise<Object>} Created VoiceCall record
   */
  async triggerUrgentCall({ donationId, recipientPhone, recipientId = null }) {
    if (!donationId || !recipientPhone) {
      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Both donationId and recipientPhone are required to trigger an AI voice call'
      );
    }

    const donation = await Donation.findById(donationId);
    if (!donation) {
      throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${donationId}' not found`);
    }

    const callId = `call_mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const maskedPhone = maskPhoneNumber(recipientPhone);

    // SECURITY PRIVACY INVARIANT: Raw phone numbers must NEVER be logged to console or stdout
    console.log(
      `[AI Call Stub] Triggered call to ${maskedPhone} for donation ${donationId}`
    );

    const callRecord = await VoiceCall.create({
      callId,
      recipientPhone,
      donationId,
      recipientId,
      status: VOICE_CALL_STATUS.INITIATED,
      transcript: `Hello, this is an automated dispatch from Share A Plate regarding urgent food donation "${donation.foodName}".`,
      createdAt: new Date(),
    });

    return callRecord;
  }

  /**
   * Retrieves status of a call record by its MongoDB ID or callId.
   *
   * @param {string} id - MongoDB ID or callId
   * @returns {Promise<Object>}
   */
  async getCallStatus(id) {
    let callRecord = null;
    if (id.startsWith('call_mock_')) {
      callRecord = await VoiceCall.findOne({ callId: id });
    } else {
      callRecord = await VoiceCall.findById(id);
    }

    if (!callRecord) {
      throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Voice call record '${id}' not found`);
    }

    return callRecord;
  }
}

const voiceCallService = new MockVoiceCallProvider();

module.exports = {
  voiceCallService,
  MockVoiceCallProvider,
};
