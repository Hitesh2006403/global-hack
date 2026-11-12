const Notification = require('../models/Notification');
const { NOTIFICATION_TYPES } = require('../models/Notification');
const Donation = require('../models/Donation');
const { DONATION_STATUS, ACCEPTANCE_STATUS } = require('../constants/status');
const { computeCountdown } = require('./donationStateService');

/**
 * Creates an in-app notification for a specific user.
 * Supports both positional parameters and object payload signature:
 *   createNotification(userId, type, title, message, donationId)
 *   createNotification(userId, { type, title, message, donationId })
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string|Object} typeOrPayload
 * @param {string} [title]
 * @param {string} [message]
 * @param {string|mongoose.Types.ObjectId} [donationId]
 * @returns {Promise<Object>} Created notification document
 */
const createNotification = async (userId, typeOrPayload, title, message, donationId) => {
  let type, notifTitle, notifMessage, notifDonationId;

  if (typeof typeOrPayload === 'object' && typeOrPayload !== null) {
    type = typeOrPayload.type || NOTIFICATION_TYPES.STATUS_UPDATE;
    notifTitle = typeOrPayload.title;
    notifMessage = typeOrPayload.message;
    notifDonationId = typeOrPayload.donationId || null;
  } else {
    type = typeOrPayload || NOTIFICATION_TYPES.STATUS_UPDATE;
    notifTitle = title;
    notifMessage = message;
    notifDonationId = donationId || null;
  }

  return Notification.create({
    userId,
    type,
    title: notifTitle,
    message: notifMessage,
    donationId: notifDonationId,
  });
};

/**
 * Sweeps active donations approaching effective expiry and issues deduplicated urgency alerts.
 * Notifies the posting donor and any attached recipients when time remaining drops below the threshold.
 *
 * @param {number} [overrideThreshold] - Optional threshold in minutes (defaults to env or 30)
 * @returns {Promise<number>} Number of new notifications dispatched
 */
const createUrgencyNotifications = async (overrideThreshold) => {
  const thresholdMinutes =
    overrideThreshold !== undefined
      ? overrideThreshold
      : parseInt(process.env.URGENCY_THRESHOLD_MINUTES, 10) || 30;

  // Find discoverable or partially claimed donations that are not yet swept as expired
  const activeDonations = await Donation.find({
    status: {
      $in: [
        DONATION_STATUS.AVAILABLE,
        DONATION_STATUS.PARTIALLY_ACCEPTED,
        DONATION_STATUS.REOPENED,
      ],
    },
    remainingQuantity: { $gt: 0 },
  });

  let createdCount = 0;

  for (const donation of activeDonations) {
    const { secondsToEffectiveExpiry } = computeCountdown(donation);
    const minutesLeft = Math.floor(secondsToEffectiveExpiry / 60);

    // If within urgency threshold but not yet expired
    if (secondsToEffectiveExpiry > 0 && minutesLeft <= thresholdMinutes) {
      // 1. Notify the posting Donor (deduplicated per donation)
      const existingDonorAlert = await Notification.findOne({
        userId: donation.donorId,
        donationId: donation._id,
        type: { $in: [NOTIFICATION_TYPES.EXPIRING_SOON, NOTIFICATION_TYPES.URGENCY_ALERT] },
      });

      if (!existingDonorAlert) {
        await createNotification(
          donation.donorId,
          NOTIFICATION_TYPES.EXPIRING_SOON,
          'Donation Expiring Soon',
          `Your donation "${donation.foodName}" has approximately ${minutesLeft} minutes left before safe expiry.`,
          donation._id
        );
        createdCount += 1;
      }

      // 2. Notify any attached recipients with active claims
      if (Array.isArray(donation.acceptances)) {
        for (const acc of donation.acceptances) {
          if (
            acc.status === ACCEPTANCE_STATUS.CLAIMED ||
            acc.status === ACCEPTANCE_STATUS.PICKUP_SCHEDULED
          ) {
            const existingRecipientAlert = await Notification.findOne({
              userId: acc.recipientId,
              donationId: donation._id,
              type: { $in: [NOTIFICATION_TYPES.EXPIRING_SOON, NOTIFICATION_TYPES.URGENCY_ALERT] },
            });

            if (!existingRecipientAlert) {
              await createNotification(
                acc.recipientId,
                NOTIFICATION_TYPES.EXPIRING_SOON,
                'Pickup Expiry Warning',
                `Donation "${donation.foodName}" has only ${minutesLeft} minutes left before safe expiry. Please ensure pickup is completed promptly.`,
                donation._id
              );
              createdCount += 1;
            }
          }
        }
      }
    }
  }

  return createdCount;
};

module.exports = {
  createNotification,
  createUrgencyNotifications,
};
