const { voiceCallService } = require('../services/voiceCallService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { ROLES } = require('../constants/roles');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/v1/notifications/ai-call/trigger
 * Dispatches an automated urgent voice call.
 * Access: Administrator only.
 */
const triggerAiCall = asyncHandler(async (req, res) => {
  const { donationId, recipientPhone, recipientId } = req.body;

  if (!donationId || !recipientPhone) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Both donationId and recipientPhone are required to trigger an AI voice call'
    );
  }

  const callRecord = await voiceCallService.triggerUrgentCall({
    donationId,
    recipientPhone,
    recipientId,
  });

  return ApiResponse.send(res, 201, 'AI voice call dispatched successfully', {
    call: callRecord,
  });
});

/**
 * GET /api/v1/notifications/ai-call/:id
 * Retrieves status and audit record of an AI voice call.
 * Access: Admin, or the target recipient user for whom the call was placed.
 */
const getAiCallStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const callRecord = await voiceCallService.getCallStatus(id);

  const isAdmin = req.user.role === ROLES.ADMIN;
  const isTargetRecipient =
    callRecord.recipientId &&
    callRecord.recipientId.toString() === req.user._id.toString();

  if (!isAdmin && !isTargetRecipient) {
    throw new ApiError(
      403,
      ERROR_CODES.FORBIDDEN,
      'You are not authorized to view the status of this voice call'
    );
  }

  return ApiResponse.send(res, 200, 'Voice call record retrieved successfully', {
    call: callRecord,
  });
});

module.exports = {
  triggerAiCall,
  getAiCallStatus,
};
