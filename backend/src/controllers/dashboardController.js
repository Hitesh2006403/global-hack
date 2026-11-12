const Donation = require('../models/Donation');
const RecipientRequirement = require('../models/RecipientRequirement');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { DONATION_STATUS, REQUIREMENT_STATUS } = require('../constants/status');
const { ROLES } = require('../constants/roles');
const { toDonationView } = require('../utils/donationView');

// In-memory cache for public impact stats (60s TTL)
let impactCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

/**
 * GET /api/v1/dashboard/impact
 * Public platform impact metrics.
 * Strictly anonymous with zero PII (no names, phones, or emails).
 * Rate-limited and cached for 60 seconds (cache disabled in test).
 */
const getPublicImpact = asyncHandler(async (req, res) => {
  const currentTime = Date.now();
  if (process.env.NODE_ENV !== 'test' && impactCache && (currentTime - lastCacheTime < CACHE_TTL_MS)) {
    return ApiResponse.send(res, 200, 'Impact statistics retrieved successfully', impactCache);
  }
  // 1. Total meals saved across all completed acceptances
  const mealsAgg = await Donation.aggregate([
    { $unwind: '$acceptances' },
    { $match: { 'acceptances.status': 'COMPLETED' } },
    {
      $project: {
        meals: {
          $multiply: [
            '$acceptances.quantity',
            {
              $switch: {
                branches: [
                  { case: { $eq: ['$unit', 'kg'] }, then: 2.5 },
                  { case: { $eq: ['$unit', 'plates'] }, then: 1.0 },
                  { case: { $eq: ['$unit', 'servings'] }, then: 1.0 },
                  { case: { $eq: ['$unit', 'packets'] }, then: 1.0 },
                ],
                default: 1.0,
              },
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalMeals: { $sum: '$meals' },
      },
    },
  ]);
  const mealsSaved = mealsAgg.length > 0 ? Number(mealsAgg[0].totalMeals.toFixed(1)) : 0;

  // 2. Donation completion and active volume
  const [totalDonationsCompleted, totalDonationsPosted, activeDonationsCount] = await Promise.all([
    Donation.countDocuments({ status: DONATION_STATUS.COMPLETED }),
    Donation.countDocuments(),
    Donation.countDocuments({
      status: {
        $in: [
          DONATION_STATUS.AVAILABLE,
          DONATION_STATUS.PARTIALLY_ACCEPTED,
          DONATION_STATUS.ACCEPTED,
          DONATION_STATUS.PICKUP_SCHEDULED,
          DONATION_STATUS.PICKED_UP,
          DONATION_STATUS.HANDOVER_VERIFIED,
          DONATION_STATUS.REOPENED,
          DONATION_STATUS.REMATCHING,
        ],
      },
    }),
  ]);

  // 3. Percent completed before effective expiry
  const completionAgg = await Donation.aggregate([
    { $unwind: '$acceptances' },
    { $match: { 'acceptances.status': 'COMPLETED' } },
    {
      $project: {
        effectiveExpiryAt: {
          $subtract: [
            '$expiryAt',
            { $multiply: [{ $ifNull: ['$safetyBufferMinutes', 60] }, 60000] },
          ],
        },
        handoverTime: {
          $ifNull: [
            '$acceptances.handoverVerifiedAt',
            { $ifNull: ['$acceptances.completedAt', '$acceptances.updatedAt'] },
          ],
        },
      },
    },
    {
      $project: {
        beforeExpiry: {
          $cond: [{ $lte: ['$handoverTime', '$effectiveExpiryAt'] }, 1, 0],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalCompleted: { $sum: 1 },
        completedBeforeExpiry: { $sum: '$beforeExpiry' },
      },
    },
  ]);

  let percentCompletedBeforeExpiry = 0;
  if (completionAgg.length > 0 && completionAgg[0].totalCompleted > 0) {
    percentCompletedBeforeExpiry = Number(
      ((completionAgg[0].completedBeforeExpiry / completionAgg[0].totalCompleted) * 100).toFixed(1)
    );
  }

  // 4. Average time to match in minutes (first acceptance claimedAt - donation createdAt)
  const matchTimeAgg = await Donation.aggregate([
    { $match: { 'acceptances.0': { $exists: true } } },
    {
      $project: {
        firstClaimedAt: { $arrayElemAt: ['$acceptances.claimedAt', 0] },
        createdAt: '$createdAt',
      },
    },
    {
      $match: {
        firstClaimedAt: { $ne: null },
        createdAt: { $ne: null },
      },
    },
    {
      $project: {
        diffMinutes: {
          $divide: [{ $subtract: ['$firstClaimedAt', '$createdAt'] }, 60000],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgDiff: { $avg: '$diffMinutes' },
      },
    },
  ]);

  const avgTimeToMatchMinutes =
    matchTimeAgg.length > 0 && matchTimeAgg[0].avgDiff !== null
      ? Number(Math.max(0, matchTimeAgg[0].avgDiff).toFixed(1))
      : null;

  // 5. Verified user counts
  const [registeredDonors, registeredRecipients] = await Promise.all([
    User.countDocuments({ role: ROLES.DONOR }),
    User.countDocuments({ role: ROLES.RECIPIENT, isVerified: true }),
  ]);

  const responseData = {
    mealsSaved,
    percentCompletedBeforeExpiry,
    avgTimeToMatchMinutes,
    totalDonationsPosted,
    totalDonationsCompleted,
    activeDonationsCount,
    registeredDonorsCount: registeredDonors,
    registeredRecipientsCount: registeredRecipients,
  };

  if (process.env.NODE_ENV !== 'test') {
    impactCache = responseData;
    lastCacheTime = currentTime;
  }

  return ApiResponse.send(res, 200, 'Impact statistics retrieved successfully', responseData);
});

/**
 * GET /api/v1/dashboard/donor
 * Donor personal analytics.
 * Access: Donor only.
 */
const getDonorDashboard = asyncHandler(async (req, res) => {
  const donorId = req.user._id;

  // 1. Status breakdown
  const statusCountsAgg = await Donation.aggregate([
    { $match: { donorId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const countsPerStatus = {};
  Object.values(DONATION_STATUS).forEach((status) => {
    countsPerStatus[status] = 0;
  });
  statusCountsAgg.forEach((item) => {
    countsPerStatus[item._id] = item.count;
  });

  // 2. Total meals contributed
  const mealsAgg = await Donation.aggregate([
    { $match: { donorId } },
    { $unwind: '$acceptances' },
    { $match: { 'acceptances.status': 'COMPLETED' } },
    {
      $project: {
        meals: {
          $multiply: [
            '$acceptances.quantity',
            {
              $switch: {
                branches: [
                  { case: { $eq: ['$unit', 'kg'] }, then: 2.5 },
                  { case: { $eq: ['$unit', 'plates'] }, then: 1.0 },
                  { case: { $eq: ['$unit', 'servings'] }, then: 1.0 },
                  { case: { $eq: ['$unit', 'packets'] }, then: 1.0 },
                ],
                default: 1.0,
              },
            },
          ],
        },
      },
    },
    { $group: { _id: null, total: { $sum: '$meals' } } },
  ]);
  const mealsContributed = mealsAgg.length > 0 ? Number(mealsAgg[0].total.toFixed(1)) : 0;

  // 3. Completion rate
  const [totalDonations, completedDonations] = await Promise.all([
    Donation.countDocuments({ donorId }),
    Donation.countDocuments({ donorId, status: DONATION_STATUS.COMPLETED }),
  ]);
  const completionRate =
    totalDonations > 0 ? Number(((completedDonations / totalDonations) * 100).toFixed(1)) : 0;

  // 4. Last 5 donations formatted with role-scoped view
  const last5 = await Donation.find({ donorId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('donorId', 'name ratingAverage ratingCount phone');
  const last5Donations = last5.map((d) => toDonationView(d, req.user));

  return ApiResponse.send(res, 200, 'Donor dashboard retrieved successfully', {
    countsPerStatus,
    mealsContributed,
    completionRate,
    last5Donations,
    totalDonations,
  });
});

/**
 * GET /api/v1/dashboard/recipient
 * Recipient personal demand & claims dashboard.
 * Access: Verified Recipient only.
 */
const getRecipientDashboard = asyncHandler(async (req, res) => {
  const recipientId = req.user._id;

  // 1. Requirements status breakdown
  const reqCountsAgg = await RecipientRequirement.aggregate([
    { $match: { recipientId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const countsPerStatus = {};
  Object.values(REQUIREMENT_STATUS).forEach((status) => {
    countsPerStatus[status] = 0;
  });
  reqCountsAgg.forEach((item) => {
    countsPerStatus[item._id] = item.count;
  });

  // 2. Total accepted quantity across donations
  const qtyAgg = await Donation.aggregate([
    { $unwind: '$acceptances' },
    { $match: { 'acceptances.recipientId': recipientId } },
    { $group: { _id: null, totalQty: { $sum: '$acceptances.quantity' } } },
  ]);
  const totalAcceptedQuantity = qtyAgg.length > 0 ? qtyAgg[0].totalQty : 0;

  // 3. Completed meals received
  const mealsAgg = await Donation.aggregate([
    { $unwind: '$acceptances' },
    {
      $match: {
        'acceptances.recipientId': recipientId,
        'acceptances.status': 'COMPLETED',
      },
    },
    {
      $project: {
        meals: {
          $multiply: [
            '$acceptances.quantity',
            {
              $switch: {
                branches: [
                  { case: { $eq: ['$unit', 'kg'] }, then: 2.5 },
                  { case: { $eq: ['$unit', 'plates'] }, then: 1.0 },
                  { case: { $eq: ['$unit', 'servings'] }, then: 1.0 },
                  { case: { $eq: ['$unit', 'packets'] }, then: 1.0 },
                ],
                default: 1.0,
              },
            },
          ],
        },
      },
    },
    { $group: { _id: null, total: { $sum: '$meals' } } },
  ]);
  const completedMeals = mealsAgg.length > 0 ? Number(mealsAgg[0].total.toFixed(1)) : 0;

  // 4. Last 5 acceptances
  const claimedDonations = await Donation.find({
    'acceptances.recipientId': recipientId,
  })
    .populate('donorId', 'name organization phone')
    .lean();

  const allClaims = [];
  for (const d of claimedDonations) {
    for (const acc of d.acceptances || []) {
      if (acc.recipientId.toString() === recipientId.toString()) {
        allClaims.push({
          _id: acc._id,
          donationId: d._id,
          foodName: d.foodName,
          foodType: d.foodType,
          unit: d.unit,
          quantity: acc.quantity,
          status: acc.status,
          pickupPreference: acc.pickupPreference,
          claimedAt: acc.claimedAt,
          handoverVerifiedAt: acc.handoverVerifiedAt,
          completedAt: acc.completedAt,
          donorName: d.donorId?.name || null,
          donorOrg: d.donorId?.organization?.name || null,
          address: {
            city: d.address?.city,
            formattedAddress: d.address?.formattedAddress,
          },
        });
      }
    }
  }
  allClaims.sort((a, b) => new Date(b.claimedAt) - new Date(a.claimedAt));
  const last5Acceptances = allClaims.slice(0, 5);

  return ApiResponse.send(res, 200, 'Recipient dashboard retrieved successfully', {
    countsPerStatus,
    totalAcceptedQuantity,
    completedMeals,
    last5Acceptances,
  });
});

module.exports = {
  getPublicImpact,
  getDonorDashboard,
  getRecipientDashboard,
  _getImpactCache: () => impactCache,
  _setImpactCache: (cache, time) => {
    impactCache = cache;
    lastCacheTime = time;
  },
};
