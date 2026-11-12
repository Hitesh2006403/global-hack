const Donation = require('../models/Donation');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');
const { DONATION_STATUS, ACCEPTANCE_STATUS } = require('../constants/status');
const { ROLES } = require('../constants/roles');
const {
  assertTransition,
  appendHistory,
  isExpired,
} = require('../services/donationStateService');
const { toDonationView } = require('../utils/donationView');
const { storageService } = require('../services/storageService');

/**
 * POST /api/v1/donations
 * Creates a new surplus food donation post.
 * Access: Donor only.
 */
const createDonation = asyncHandler(async (req, res) => {
  const payload = req.body;
  const derivedAreaLabel =
    payload.areaLabel ||
    (payload.address && payload.address.state
      ? `${payload.address.city}, ${payload.address.state}`
      : payload.address?.city || 'Local Area');

  const donation = new Donation({
    ...payload,
    areaLabel: derivedAreaLabel,
    donorId: req.user._id,
    remainingQuantity: payload.totalQuantity,
    status: DONATION_STATUS.AVAILABLE,
    acceptances: [],
    statusHistory: [
      {
        status: DONATION_STATUS.AVAILABLE,
        changedBy: req.user._id,
        note: 'Donation published by donor',
        timestamp: new Date(),
      },
    ],
  });

  await donation.save();
  await donation.populate('donorId', 'name ratingAverage ratingCount phone');

  return ApiResponse.send(
    res,
    201,
    'Donation created successfully',
    toDonationView(donation, req.user)
  );
});

/**
 * GET /api/v1/donations/my
 * Lists all donations posted by the authenticated donor.
 * Access: Donor only.
 */
const getMyDonations = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const filter = { donorId: req.user._id };
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('donorId', 'name ratingAverage ratingCount phone'),
    Donation.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;
  const viewData = donations.map((d) => toDonationView(d, req.user));

  return ApiResponse.send(res, 200, 'My donations retrieved', viewData, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * GET /api/v1/donations/available
 * Lists available donations matching recipient criteria.
 * Filters strictly by active availability, positive balance, and dynamic effective expiry.
 * Access: Recipient (verified), Delivery Agent (verified), Admin.
 */
const getAvailableDonations = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const now = new Date();

  // Core availability criteria with per-donation dynamic safety buffer
  const filter = {
    status: {
      $in: [
        DONATION_STATUS.AVAILABLE,
        DONATION_STATUS.PARTIALLY_ACCEPTED,
        DONATION_STATUS.REOPENED,
      ],
    },
    remainingQuantity: { $gt: 0 },
    $expr: {
      $gt: [
        {
          $subtract: [
            '$expiryAt',
            { $multiply: [{ $ifNull: ['$safetyBufferMinutes', 60] }, 60000] },
          ],
        },
        now,
      ],
    },
  };

  if (req.query.foodType) {
    filter.foodType = req.query.foodType;
  }
  if (req.query.dietaryType) {
    filter.dietaryType = req.query.dietaryType;
  }

  // Geospatial proximity filtering if coordinates are provided
  let userCoordinates = null;
  if (req.query.lat !== undefined || req.query.lng !== undefined) {
    if (req.query.lat === undefined || req.query.lng === undefined) {
      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Both lat and lng coordinates must be provided together'
      );
    }
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Latitude must be between -90 and 90, and longitude between -180 and 180'
      );
    }
    let maxDistanceKm = 25;
    if (req.query.maxDistanceKm !== undefined) {
      const parsedDist = parseFloat(req.query.maxDistanceKm);
      if (isNaN(parsedDist) || parsedDist <= 0 || parsedDist > 500) {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'maxDistanceKm must be a positive number up to 500'
        );
      }
      maxDistanceKm = parsedDist;
    }
    userCoordinates = [lng, lat];

    filter.location = {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: userCoordinates,
        },
        $maxDistance: maxDistanceKm * 1000, // Convert km to meters
      },
    };
  }

  const countFilter = { ...filter };
  if (countFilter.location && countFilter.location.$nearSphere) {
    const coords = countFilter.location.$nearSphere.$geometry.coordinates;
    const maxMeters = countFilter.location.$nearSphere.$maxDistance;
    const rad = maxMeters / (6378.1 * 1000);
    countFilter.location = {
      $geoWithin: {
        $centerSphere: [coords, rad],
      },
    };
  }

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .skip(skip)
      .limit(limit)
      .populate('donorId', 'name ratingAverage ratingCount phone'),
    Donation.countDocuments(countFilter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  // Map donations to role-scoped privacy views (distance calculated securely inside toDonationView)
  const viewData = donations.map((d) => toDonationView(d, req.user, userCoordinates));

  return ApiResponse.send(res, 200, 'Available donations retrieved', viewData, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * GET /api/v1/donations
 * Administrative or filtered listing of all platform donations.
 */
const listDonations = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.foodType) {
    filter.foodType = req.query.foodType;
  }
  if (req.query.donorId) {
    filter.donorId = req.query.donorId;
  }

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('donorId', 'name ratingAverage ratingCount phone'),
    Donation.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;
  const viewData = donations.map((d) => toDonationView(d, req.user));

  return ApiResponse.send(res, 200, 'Donations retrieved', viewData, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * GET /api/v1/donations/:id
 * Retrieve a single donation by ID.
 * Enforces lazy expiry check and role-scoped privacy views.
 */
const getDonationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const now = new Date();

  const prePickupStatuses = [
    DONATION_STATUS.AVAILABLE,
    DONATION_STATUS.PARTIALLY_ACCEPTED,
    DONATION_STATUS.REOPENED,
    DONATION_STATUS.ACCEPTED,
    DONATION_STATUS.PICKUP_SCHEDULED,
  ];

  // Atomic lazy expiry transition: if pre-pickup and effectiveExpiryAt <= now, update atomically in one operation
  let donation = await Donation.findOneAndUpdate(
    {
      _id: id,
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
          note: 'Expired: Safe consumption window exceeded',
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
      returnDocument: 'after',
    }
  ).populate('donorId', 'name ratingAverage ratingCount phone');

  // If not expired via atomic update, fetch the existing donation
  if (!donation) {
    donation = await Donation.findById(id).populate(
      'donorId',
      'name ratingAverage ratingCount phone'
    );
  }

  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
  }

  return ApiResponse.send(
    res,
    200,
    'Donation retrieved',
    toDonationView(donation, req.user)
  );
});

/**
 * PATCH /api/v1/donations/:id
 * Updates mutable fields of an unaccepted donation.
 * Allowed strictly when status === AVAILABLE and acceptances.length === 0.
 * Single atomic conditional update preventing race conditions.
 * Access: Owner Donor only.
 */
const updateDonation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Build whitelist of mutable fields
  const updateFields = {};
  if (updates.foodName) updateFields.foodName = updates.foodName;
  if (updates.packagingType) updateFields.packagingType = updates.packagingType;
  if (updates.instructions !== undefined) updateFields.instructions = updates.instructions;
  if (updates.pickupWindowEnd) updateFields.pickupWindowEnd = updates.pickupWindowEnd;
  if (updates.photos) updateFields.photos = updates.photos;

  const atomicFilter = {
    _id: id,
    status: DONATION_STATUS.AVAILABLE,
    'acceptances.0': { $exists: false },
  };

  if (req.user.role !== ROLES.ADMIN) {
    atomicFilter.donorId = req.user._id;
  }

  const updatedDonation = await Donation.findOneAndUpdate(
    atomicFilter,
    { $set: updateFields },
    { returnDocument: 'after', runValidators: true }
  ).populate('donorId', 'name ratingAverage ratingCount phone');

  if (!updatedDonation) {
    // Condition failed or not found or not owner
    const existing = await Donation.findById(id);
    if (!existing) {
      throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
    }
    if (req.user.role !== ROLES.ADMIN && existing.donorId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You do not have permission to edit this donation');
    }
    // Condition on status or acceptances failed
    throw new ApiError(
      409,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      'Cannot edit donation once claimed or after leaving AVAILABLE status. Please cancel and recreate if changes are required.'
    );
  }

  return ApiResponse.send(
    res,
    200,
    'Donation updated successfully',
    toDonationView(updatedDonation, req.user)
  );
});

/**
 * POST /api/v1/donations/:id/cancel
 * Cancels a donation before pickup occurs.
 * Single atomic conditional update setting status CANCELLED, cancelling active acceptances,
 * and pushing audit history in one operation.
 * Access: Owner Donor or Admin.
 */
const cancelDonation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason = 'Cancelled by donor' } = req.body;
  const now = new Date();

  const cancelFilter = {
    _id: id,
    status: {
      $in: [
        DONATION_STATUS.AVAILABLE,
        DONATION_STATUS.PARTIALLY_ACCEPTED,
        DONATION_STATUS.REOPENED,
      ],
    },
  };

  if (req.user.role !== ROLES.ADMIN) {
    cancelFilter.donorId = req.user._id;
  }

  const updatedDonation = await Donation.findOneAndUpdate(
    cancelFilter,
    {
      $set: {
        status: DONATION_STATUS.CANCELLED,
        'acceptances.$[activeAcc].status': ACCEPTANCE_STATUS.CANCELLED,
        'acceptances.$[activeAcc].notes': 'Donation cancelled by donor',
      },
      $push: {
        statusHistory: {
          status: DONATION_STATUS.CANCELLED,
          changedBy: req.user._id,
          note: `Donation cancelled: ${reason}`,
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
      returnDocument: 'after',
    }
  ).populate('donorId', 'name ratingAverage ratingCount phone');

  if (!updatedDonation) {
    const existing = await Donation.findById(id);
    if (!existing) {
      throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
    }
    if (req.user.role !== ROLES.ADMIN && existing.donorId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You do not have permission to cancel this donation');
    }
    throw new ApiError(
      409,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Cannot cancel donation in status '${existing.status}'. Only AVAILABLE or PARTIALLY_ACCEPTED donations can be cancelled.`
    );
  }

  // Remote/local storage cleanup: delete photos associated with cancelled donation
  if (Array.isArray(updatedDonation.photos) && updatedDonation.photos.length > 0) {
    for (const photo of updatedDonation.photos) {
      await storageService.deleteFile(photo.url, photo.publicId).catch(() => {});
    }
  }

  return ApiResponse.send(
    res,
    200,
    'Donation cancelled successfully',
    toDonationView(updatedDonation, req.user)
  );
});

/**
 * GET /api/v1/donations/:id/status-history
 * Retrieves full audit history of status transitions.
 * Access: Owner Donor, Admin, or an attached Recipient/Agent.
 */
const getStatusHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const donation = await Donation.findById(id).populate(
    'statusHistory.changedBy',
    'name role'
  );

  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
  }

  const isOwner = donation.donorId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === ROLES.ADMIN;
  const isAttached =
    donation.acceptances &&
    donation.acceptances.some(
      (a) =>
        a.recipientId.toString() === req.user._id.toString() ||
        (a.deliveryAgentId && a.deliveryAgentId.toString() === req.user._id.toString())
    );

  if (!isOwner && !isAdmin && !isAttached) {
    throw new ApiError(
      403,
      ERROR_CODES.FORBIDDEN,
      'You are not authorized to view the audit history for this donation'
    );
  }

  return ApiResponse.send(
    res,
    200,
    'Status history retrieved',
    donation.statusHistory
  );
});

/**
 * POST /api/v1/donations/:id/photos
 * Upload photos for an available donation.
 * Allowed ONLY for owner donor (or admin) while donation status is AVAILABLE and 0 acceptances.
 * Maximum 5 photos per donation. Max 2 MB per file.
 */
const uploadDonationPhotos = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'At least one photo file is required');
  }

  const donation = await Donation.findById(id).populate(
    'donorId',
    'name ratingAverage ratingCount phone'
  );
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
  }

  // 1. Ownership check (Donor owner or Admin)
  const isOwner =
    donation.donorId?._id?.toString() === req.user._id.toString() ||
    donation.donorId?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new ApiError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Only the posting donor can upload photos for this donation'
    );
  }

  // 2. Status invariant check (AVAILABLE only, no acceptances)
  if (
    donation.status !== DONATION_STATUS.AVAILABLE ||
    (donation.acceptances && donation.acceptances.length > 0)
  ) {
    throw new ApiError(
      409,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Cannot upload photos to a donation in status '${donation.status}'. Photos can only be uploaded while status is AVAILABLE with zero claims.`
    );
  }

  // 3. Limit check: max 5 photos total
  const currentCount = (donation.photos || []).length;
  if (currentCount + req.files.length > 5) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `Cannot upload ${req.files.length} photos. Donation already has ${currentCount} photos (maximum 5 allowed).`
    );
  }

  // 4. Save files via storage adapter
  const uploadedPhotos = [];
  for (const file of req.files) {
    const saved = await storageService.saveFile({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
    uploadedPhotos.push({
      id: saved.id || crypto.randomUUID(),
      url: saved.url || saved.toString(),
      publicId: saved.publicId || null,
    });
  }

  donation.photos.push(...uploadedPhotos);
  await donation.save();

  return ApiResponse.send(
    res,
    200,
    'Photos uploaded successfully',
    toDonationView(donation, req.user)
  );
});

/**
 * DELETE /api/v1/donations/:id/photos/:photoId
 * Remove a specific photo from an available donation.
 * Allowed ONLY for owner donor (or admin) while status is AVAILABLE with 0 acceptances.
 */
const deleteDonationPhoto = asyncHandler(async (req, res) => {
  const { id, photoId } = req.params;

  const donation = await Donation.findById(id).populate(
    'donorId',
    'name ratingAverage ratingCount phone'
  );
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
  }

  // 1. Ownership check (Donor owner or Admin)
  const isOwner =
    donation.donorId?._id?.toString() === req.user._id.toString() ||
    donation.donorId?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new ApiError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Only the posting donor can remove photos from this donation'
    );
  }

  // 2. Status invariant check (AVAILABLE only, no acceptances)
  if (
    donation.status !== DONATION_STATUS.AVAILABLE ||
    (donation.acceptances && donation.acceptances.length > 0)
  ) {
    throw new ApiError(
      409,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Cannot delete photos from a donation in status '${donation.status}'. Photos can only be removed while status is AVAILABLE with zero claims.`
    );
  }

  // 3. Find photo index by id or url match
  const photoIndex = (donation.photos || []).findIndex(
    (p) => (p.id && p.id === photoId) || (p.url && p.url.includes(photoId))
  );

  if (photoIndex === -1) {
    throw new ApiError(
      404,
      ERROR_CODES.NOT_FOUND,
      `Photo with ID '${photoId}' not found on this donation`
    );
  }

  const [removedPhoto] = donation.photos.splice(photoIndex, 1);

  // 4. Delete the physical / remote asset
  await storageService.deleteFile(removedPhoto.url, removedPhoto.publicId).catch((err) => {
    console.error(`[Storage Warning] Failed to delete photo asset: ${err.message}`);
  });

  await donation.save();

  return ApiResponse.send(
    res,
    200,
    'Photo deleted successfully',
    toDonationView(donation, req.user)
  );
});

/**
 * POST /api/v1/donations/:id/accept
 * Claim / accept portion or full quantity of a donation.
 */
const acceptDonation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantityAccepted = 1, notes, pickupPreference, requirementId } = req.body;

  const donation = await Donation.findById(id);
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Donation not found');
  }

  const qty = Number(quantityAccepted);
  if (qty <= 0 || qty > donation.remainingQuantity) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `Requested quantity (${qty}) exceeds available remaining quantity (${donation.remainingQuantity})`
    );
  }

  donation.remainingQuantity -= qty;
  const newStatus = donation.remainingQuantity === 0 ? DONATION_STATUS.ACCEPTED : DONATION_STATUS.PARTIALLY_ACCEPTED;
  donation.status = newStatus;

  const newAcceptance = {
    recipientId: req.user._id,
    requirementId: requirementId || null,
    quantity: qty,
    status: ACCEPTANCE_STATUS.CLAIMED,
    pickupPreference: pickupPreference || 'delivery_agent_required',
    claimedAt: new Date(),
    notes: notes || null,
  };

  if (!donation.acceptances) donation.acceptances = [];
  donation.acceptances.push(newAcceptance);

  donation.statusHistory.push({
    status: newStatus,
    changedBy: req.user._id,
    note: `Claimed ${qty} ${donation.unit} by ${req.user.name}`,
    timestamp: new Date(),
  });

  await donation.save();
  await donation.populate('donorId', 'name ratingAverage ratingCount phone');

  return ApiResponse.send(
    res,
    200,
    'Donation claimed successfully',
    toDonationView(donation, req.user)
  );
});

/**
 * PATCH /api/v1/donations/:id/reopen
 * Reopen a cancelled or partially remaining donation.
 */
const reopenDonation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const donation = await Donation.findById(id);
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Donation not found');
  }

  donation.status = DONATION_STATUS.REOPENED;
  donation.statusHistory.push({
    status: DONATION_STATUS.REOPENED,
    changedBy: req.user._id,
    note: notes || 'Donation reopened for community matching',
    timestamp: new Date(),
  });

  await donation.save();
  await donation.populate('donorId', 'name ratingAverage ratingCount phone');

  return ApiResponse.send(
    res,
    200,
    'Donation reopened successfully',
    toDonationView(donation, req.user)
  );
});

module.exports = {
  createDonation,
  getMyDonations,
  getAvailableDonations,
  listDonations,
  getDonationById,
  updateDonation,
  cancelDonation,
  getStatusHistory,
  uploadDonationPhotos,
  deleteDonationPhoto,
  acceptDonation,
  reopenDonation,
};
