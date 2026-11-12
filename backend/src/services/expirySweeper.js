const Donation = require('../models/Donation');
const { DONATION_STATUS, ACCEPTANCE_STATUS } = require('../constants/status');

/**
 * Sweeps the database for donations that have crossed their effective expiry threshold.
 * Applies strictly to pre-pickup statuses (once picked up, food is in physical transit).
 *
 * @returns {Promise<{ modifiedCount: number }>}
 */
const sweepExpiredDonations = async () => {
  const now = new Date();

  const prePickupStatuses = [
    DONATION_STATUS.AVAILABLE,
    DONATION_STATUS.PARTIALLY_ACCEPTED,
    DONATION_STATUS.REOPENED,
    DONATION_STATUS.ACCEPTED,
    DONATION_STATUS.PICKUP_SCHEDULED,
  ];

  try {
    const result = await Donation.updateMany(
      {
        status: { $in: prePickupStatuses },
        $expr: {
          $lte: [
            {
              $subtract: [
                '$expiryAt',
                { $multiply: [{ $ifNull: ['$safetyBufferMinutes', 60] }, 60000] },
              ],
            },
            now,
          ],
        },
      },
      {
        $set: {
          status: DONATION_STATUS.EXPIRED,
          'acceptances.$[activeAcc].status': ACCEPTANCE_STATUS.CANCELLED,
          'acceptances.$[activeAcc].notes': 'expired',
        },
        $push: {
          statusHistory: {
            status: DONATION_STATUS.EXPIRED,
            changedBy: null,
            note: 'System background expiry sweep: safe window exceeded',
            timestamp: now,
          },
        },
      },
      {
        arrayFilters: [
          {
            'activeAcc.status': {
              $in: [ACCEPTANCE_STATUS.CLAIMED, ACCEPTANCE_STATUS.PICKUP_SCHEDULED],
            },
          },
        ],
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Expiry Sweeper] Marked ${result.modifiedCount} expired donations.`);
    }

    // Trigger deduplicated urgency alerts for remaining near-expiry donations (production/dev loop only)
    if (process.env.NODE_ENV !== 'test') {
      const { createUrgencyNotifications } = require('./notificationService');
      await createUrgencyNotifications().catch((err) => {
        console.error(`[Expiry Sweeper] Urgency notification dispatch failed: ${err.message}`);
      });
    }

    return { modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error(`[Expiry Sweeper Error] Sweep operation failed: ${error.message}`);
    throw error;
  }
};

/**
 * Initializes recurring background interval sweeper.
 *
 * @param {number} [intervalMs=300000] - Default 5 minutes
 * @returns {NodeJS.Timeout}
 */
const startExpirySweeper = (intervalMs = 300000) => {
  console.log(`[Expiry Sweeper] Initialized recurring sweep every ${intervalMs / 1000}s`);
  // Run once immediately on startup
  sweepExpiredDonations().catch(() => {});
  return setInterval(sweepExpiredDonations, intervalMs);
};

module.exports = {
  sweepExpiredDonations,
  startExpirySweeper,
};
