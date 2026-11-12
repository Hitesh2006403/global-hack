const User = require('../models/User');
const Donation = require('../models/Donation');
const { computeCountdown } = require('../services/donationStateService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * List all users with pagination and optional filtering by role, isVerified, isActive.
 */
const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.role) {
    filter.role = req.query.role;
  }
  if (req.query.isVerified !== undefined) {
    filter.isVerified = req.query.isVerified === 'true';
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return ApiResponse.send(res, 200, 'Users retrieved successfully', users, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * Approve and verify a user account (recipient or delivery agent).
 */
const verifyUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `User with ID '${id}' not found`);
  }

  user.isVerified = true;
  await user.save();

  return ApiResponse.send(res, 200, 'User account verified successfully', { user });
});

/**
 * Deactivate a user account.
 * INVARIANT: An administrator cannot deactivate their own account.
 */
const deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user._id.toString() === id) {
    throw new ApiError(
      400,
      ERROR_CODES.CANNOT_DEACTIVATE_SELF,
      'Administrators cannot deactivate their own account'
    );
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `User with ID '${id}' not found`);
  }

  user.isActive = false;
  await user.save();

  return ApiResponse.send(res, 200, 'User account deactivated successfully', { user });
});

/**
 * GET /api/v1/admin/donations
 * Administrative list of all donations with filters and metrics.
 * Includes statusHistory length, acceptance count, secondsToEffectiveExpiry.
 */
const listAdminDonations = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.donorId) {
    filter.donorId = req.query.donorId;
  }
  if (req.query.foodType) {
    filter.foodType = req.query.foodType;
  }
  if (req.query.dateFrom || req.query.dateTo) {
    filter.createdAt = {};
    if (req.query.dateFrom) {
      const dFrom = new Date(req.query.dateFrom);
      if (isNaN(dFrom.getTime())) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Invalid dateFrom query parameter format');
      }
      filter.createdAt.$gte = dFrom;
    }
    if (req.query.dateTo) {
      const dTo = new Date(req.query.dateTo);
      if (isNaN(dTo.getTime())) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Invalid dateTo query parameter format');
      }
      filter.createdAt.$lte = dTo;
    }
  }

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('donorId', 'name email phone ratingAverage ratingCount organization'),
    Donation.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  const formattedDonations = donations.map((d) => {
    const doc = d.toObject ? d.toObject({ virtuals: true }) : { ...d };
    const { secondsToEffectiveExpiry, urgencyLevel } = computeCountdown(d);
    return {
      ...doc,
      statusHistoryLength: doc.statusHistory ? doc.statusHistory.length : 0,
      statusHistoryCount: doc.statusHistory ? doc.statusHistory.length : 0,
      acceptanceCount: doc.acceptances ? doc.acceptances.length : 0,
      secondsToEffectiveExpiry,
      urgencyLevel,
    };
  });

  return ApiResponse.send(res, 200, 'Admin donations retrieved successfully', formattedDonations, {
    page,
    limit,
    total,
    totalPages,
  });
});

module.exports = {
  listUsers,
  verifyUser,
  deactivateUser,
  listAdminDonations,
};
