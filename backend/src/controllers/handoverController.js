const crypto = require('crypto');
const Donation = require('../models/Donation');
const User = require('../models/User');
const HandoverToken = require('../models/HandoverToken');
const AuditLog = require('../models/AuditLog');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');
const { DONATION_STATUS, ACCEPTANCE_STATUS } = require('../constants/status');
const { ROLES } = require('../constants/roles');

const HMAC_SECRET = process.env.QR_SIGNING_SECRET || 'share-a-plate-qr-cryptographic-signing-secret-2026';

// Server-Sent Events subscribers registry for real-time synchronization
const sseClients = new Set();

const broadcastHandoverEvent = (event) => {
  const data = `data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch (err) {
      console.error('Error broadcasting SSE event:', err);
      sseClients.delete(res);
    }
  }
};

// Cryptographic helpers
const generateSecureToken = (prefix = 'SAP-PK') => {
  const randomSegment = crypto.randomBytes(18).toString('base64url').replace(/[-_]/g, 'X').toUpperCase();
  return `${prefix}-${randomSegment.slice(0, 16)}`;
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
};

const signToken = (token, donationId, stage) => {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`${donationId}:${stage}:${token}`)
    .digest('hex');
};

// Rate limiter helper for failed scan attempts
const failedAttemptsMap = new Map();
const checkRateLimit = (key) => {
  const now = Date.now();
  const record = failedAttemptsMap.get(key) || { count: 0, lastAttempt: now };
  if (now - record.lastAttempt > 5 * 60 * 1000) {
    record.count = 0;
  }
  return record.count < 10;
};
const recordFailedAttempt = (key) => {
  const now = Date.now();
  const record = failedAttemptsMap.get(key) || { count: 0, lastAttempt: now };
  record.count += 1;
  record.lastAttempt = now;
  failedAttemptsMap.set(key, record);
};
const resetRateLimit = (key) => {
  failedAttemptsMap.delete(key);
};

/**
 * Real-time SSE Stream
 */
const streamEvents = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Handover event stream active' })}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
};

/**
 * Stage 1: Donor generates or fetches Pickup QR token
 */
const getOrCreatePickupToken = asyncHandler(async (req, res) => {
  const { donationId } = req.params;

  let donation;
  if (donationId.match(/^[0-9a-fA-F]{24}$/)) {
    donation = await Donation.findById(donationId).populate('donorId', 'name phone organization');
  } else {
    // Lookup by custom id if applicable or first match
    donation = await Donation.findOne().populate('donorId', 'name phone organization');
  }

  if (!donation) {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, `Donation "${donationId}" not found.`);
  }

  // Look for active token
  const now = new Date();
  let tokenRecord = await HandoverToken.findOne({
    donationId: donation._id,
    stage: 'PICKUP',
    status: 'ACTIVE',
    expiresAt: { $gt: now },
  });

  if (!tokenRecord) {
    // Revoke any previous active tokens
    await HandoverToken.updateMany(
      { donationId: donation._id, stage: 'PICKUP', status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: now, revocationReason: 'Regenerated' } }
    );

    const rawToken = generateSecureToken(`SAP-PK-${donation._id.toString().slice(-6).toUpperCase()}`);
    const tokenHash = hashToken(rawToken);
    const signature = signToken(rawToken, donation._id.toString(), 'PICKUP');

    // Extract assigned delivery agent and recipient from acceptances
    const activeAcceptance = donation.acceptances?.[0] || null;
    const assignedAgentId = activeAcceptance?.deliveryAgentId || null;
    const recipientId = activeAcceptance?.recipientId || null;

    tokenRecord = await HandoverToken.create({
      donationId: donation._id,
      acceptanceId: activeAcceptance?._id || null,
      stage: 'PICKUP',
      rawToken,
      tokenHash,
      signature,
      donorId: donation.donorId._id || donation.donorId,
      assignedAgentId,
      recipientId,
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
      status: 'ACTIVE',
    });

    await AuditLog.create({
      action: 'PICKUP_TOKEN_GENERATED',
      donationId: donation._id.toString(),
      stage: 'PICKUP',
      userId: req.user?._id?.toString() || donation.donorId._id?.toString(),
      userRole: req.user?.role || 'donor',
      ip: req.ip,
      success: true,
      reason: 'Dynamic cryptographic pickup token generated for donor modal',
    });

    broadcastHandoverEvent({
      type: 'TOKEN_GENERATED',
      stage: 'PICKUP',
      donationId: donation._id.toString(),
    });
  }

  return res.status(200).json({
    success: true,
    token: {
      id: tokenRecord._id,
      donationId: donation._id,
      stage: tokenRecord.stage,
      rawToken: tokenRecord.rawToken,
      tokenHash: tokenRecord.tokenHash,
      signature: tokenRecord.signature,
      expiresAt: tokenRecord.expiresAt,
      status: tokenRecord.status,
      createdAt: tokenRecord.createdAt,
    },
    donation: {
      id: donation._id,
      foodName: donation.foodName,
      donorName: donation.donorId?.name || 'Verified Donor Kitchen',
      status: donation.status,
      totalQuantity: donation.totalQuantity,
      remainingQuantity: donation.remainingQuantity,
      unit: donation.unit,
      pickupLocation: donation.address,
    },
  });
});

/**
 * Stage 2: Delivery Agent scans donor's pickup QR code (Validation)
 */
const verifyPickupScan = asyncHandler(async (req, res) => {
  const { token: inputToken } = req.body;
  const rateLimitKey = `${req.ip}_${req.user?._id || 'agent'}`;

  if (!checkRateLimit(rateLimitKey)) {
    throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many invalid scan attempts. Please wait 5 minutes.');
  }

  if (!inputToken) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Handover token is required.');
  }

  const clean = inputToken.trim();
  const hash = hashToken(clean);

  const tokenRecord = await HandoverToken.findOne({
    $or: [{ rawToken: clean }, { tokenHash: hash }],
  });

  if (!tokenRecord) {
    recordFailedAttempt(rateLimitKey);
    await AuditLog.create({
      action: 'PICKUP_SCAN_ATTEMPT',
      stage: 'PICKUP',
      ip: req.ip,
      success: false,
      reason: 'Invalid token: no matching record found.',
    });
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Invalid QR Code. This token does not match any registered donation.');
  }

  if (tokenRecord.stage !== 'PICKUP') {
    recordFailedAttempt(rateLimitKey);
    throw new ApiError(400, ERROR_CODES.INVALID_STATUS_TRANSITION, `Stage Mismatch: Scanned a ${tokenRecord.stage} token instead of a Pickup token.`);
  }

  if (tokenRecord.status === 'USED') {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Security Alert: This pickup token has already been consumed.');
  }

  if (new Date(tokenRecord.expiresAt) <= new Date()) {
    throw new ApiError(410, 'EXPIRED', 'This pickup QR code has expired. Please ask the donor to refresh.');
  }

  const donation = await Donation.findById(tokenRecord.donationId).populate('donorId', 'name phone organization');
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Associated donation not found.');
  }

  resetRateLimit(rateLimitKey);

  await AuditLog.create({
    action: 'PICKUP_SCAN_ATTEMPT',
    donationId: donation._id.toString(),
    stage: 'PICKUP',
    userId: req.user?._id?.toString() || 'user-delivery-1',
    userRole: 'delivery_agent',
    ip: req.ip,
    success: true,
    reason: 'Pickup QR validated successfully. Awaiting physical collection confirmation.',
  });

  return res.status(200).json({
    success: true,
    message: 'QR Code verified! Please complete physical safety checklist to confirm pickup.',
    tokenRecord: {
      id: tokenRecord._id,
      donationId: donation._id,
      stage: tokenRecord.stage,
      expiresAt: tokenRecord.expiresAt,
    },
    donation: {
      id: donation._id,
      foodName: donation.foodName,
      donorName: donation.donorId?.name || 'Verified Donor Kitchen',
      donorPhone: donation.donorId?.phone || '+91 98765 43210',
      totalQuantity: donation.totalQuantity,
      remainingQuantity: donation.remainingQuantity,
      unit: donation.unit,
      storageCondition: donation.packagingType,
      pickupLocation: donation.address,
      status: donation.status,
    },
  });
});

/**
 * Stage 2: Delivery Agent confirms physical pickup
 */
const confirmPickup = asyncHandler(async (req, res) => {
  const { tokenId, token: rawToken, safetyChecklist, notes } = req.body;
  const agentId = req.user?._id || req.body.agentId;

  let tokenRecord;
  if (tokenId) {
    tokenRecord = await HandoverToken.findById(tokenId);
  } else if (rawToken) {
    const clean = rawToken.trim();
    tokenRecord = await HandoverToken.findOne({
      $or: [{ rawToken: clean }, { tokenHash: hashToken(clean) }],
    });
  }

  if (!tokenRecord || tokenRecord.stage !== 'PICKUP') {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Valid pickup token record required to confirm pickup.');
  }

  if (
    !safetyChecklist ||
    !safetyChecklist.sealIntact ||
    !safetyChecklist.temperatureChecked ||
    !safetyChecklist.noSpillage ||
    !safetyChecklist.labelPresent
  ) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'All 4 mandatory food safety checkpoints must be verified.');
  }

  // Atomic token consumption
  const now = new Date();
  const updatedToken = await HandoverToken.findOneAndUpdate(
    { _id: tokenRecord._id, status: 'ACTIVE' },
    {
      $set: {
        status: 'USED',
        usedAt: now,
        usedByUserId: agentId || null,
        usedByRole: 'delivery_agent',
      },
    },
    { new: true }
  );

  if (!updatedToken) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Pickup token has already been consumed or is no longer active.');
  }

  // Update donation status to PICKED_UP
  const donation = await Donation.findById(tokenRecord.donationId);
  if (donation) {
    donation.status = DONATION_STATUS.PICKED_UP;
    donation.statusHistory.push({
      status: DONATION_STATUS.PICKED_UP,
      changedBy: agentId || null,
      note: notes || 'Physical pickup confirmed by delivery agent',
      timestamp: now,
    });
    if (donation.acceptances && donation.acceptances.length > 0) {
      donation.acceptances[0].status = ACCEPTANCE_STATUS.PICKED_UP;
    }
    await donation.save();
  }

  // GENERATE STAGE 2: RECEIPT TOKEN FOR SHELTER
  const rawReceiptToken = generateSecureToken(`SAP-RC-${donation._id.toString().slice(-6).toUpperCase()}`);
  const receiptTokenRecord = await HandoverToken.create({
    donationId: donation._id,
    acceptanceId: donation.acceptances?.[0]?._id || null,
    stage: 'RECEIPT',
    rawToken: rawReceiptToken,
    tokenHash: hashToken(rawReceiptToken),
    signature: signToken(rawReceiptToken, donation._id.toString(), 'RECEIPT'),
    donorId: donation.donorId,
    assignedAgentId: agentId || null,
    recipientId: donation.acceptances?.[0]?.recipientId || null,
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
    status: 'ACTIVE',
  });

  await AuditLog.create({
    action: 'PICKUP_CONFIRMED',
    donationId: donation._id.toString(),
    stage: 'PICKUP',
    userId: agentId?.toString(),
    userRole: 'delivery_agent',
    ip: req.ip,
    success: true,
    reason: 'Physical food collection confirmed. Generated Stage 2 Receipt token.',
    metadata: { receiptTokenId: receiptTokenRecord._id.toString() },
  });

  broadcastHandoverEvent({
    type: 'PICKUP_CONFIRMED',
    donationId: donation._id.toString(),
    status: DONATION_STATUS.PICKED_UP,
    receiptTokenId: receiptTokenRecord._id.toString(),
  });

  return res.status(200).json({
    success: true,
    message: 'Food pickup confirmed! Status updated to PICKED_UP.',
    donation,
    receiptToken: {
      id: receiptTokenRecord._id,
      stage: receiptTokenRecord.stage,
      rawToken: receiptTokenRecord.rawToken,
      tokenHash: receiptTokenRecord.tokenHash,
      signature: receiptTokenRecord.signature,
      expiresAt: receiptTokenRecord.expiresAt,
      status: receiptTokenRecord.status,
    },
  });
});

/**
 * Stage 2 / 3: Delivery agent fetches Receipt QR token to present to recipient
 */
const getReceiptToken = asyncHandler(async (req, res) => {
  const { donationId } = req.params;

  let donation;
  if (donationId.match(/^[0-9a-fA-F]{24}$/)) {
    donation = await Donation.findById(donationId);
  } else {
    donation = await Donation.findOne();
  }

  if (!donation) {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Donation not found.');
  }

  let receiptToken = await HandoverToken.findOne({
    donationId: donation._id,
    stage: 'RECEIPT',
    status: 'ACTIVE',
    expiresAt: { $gt: new Date() },
  });

  if (!receiptToken) {
    const rawReceiptToken = generateSecureToken(`SAP-RC-${donation._id.toString().slice(-6).toUpperCase()}`);
    receiptToken = await HandoverToken.create({
      donationId: donation._id,
      stage: 'RECEIPT',
      rawToken: rawReceiptToken,
      tokenHash: hashToken(rawReceiptToken),
      signature: signToken(rawReceiptToken, donation._id.toString(), 'RECEIPT'),
      donorId: donation.donorId,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      status: 'ACTIVE',
    });
  }

  return res.status(200).json({
    success: true,
    token: {
      id: receiptToken._id,
      donationId: donation._id,
      stage: receiptToken.stage,
      rawToken: receiptToken.rawToken,
      tokenHash: receiptToken.tokenHash,
      signature: receiptToken.signature,
      expiresAt: receiptToken.expiresAt,
      status: receiptToken.status,
    },
    donation,
  });
});

/**
 * Stage 3: Recipient scans delivery agent's receipt QR code (Validation)
 */
const verifyReceiptScan = asyncHandler(async (req, res) => {
  const { token: inputToken } = req.body;
  const rateLimitKey = `${req.ip}_${req.user?._id || 'recipient'}`;

  if (!checkRateLimit(rateLimitKey)) {
    throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many invalid attempts. Please wait 5 minutes.');
  }

  if (!inputToken) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Receipt token is required.');
  }

  const clean = inputToken.trim();
  const tokenRecord = await HandoverToken.findOne({
    $or: [{ rawToken: clean }, { tokenHash: hashToken(clean) }],
  });

  if (!tokenRecord) {
    recordFailedAttempt(rateLimitKey);
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Invalid QR Code. No delivery receipt matches this token.');
  }

  if (tokenRecord.stage !== 'RECEIPT') {
    throw new ApiError(400, ERROR_CODES.INVALID_STATUS_TRANSITION, 'Stage Mismatch: Scanned token is not a Delivery Receipt token.');
  }

  if (tokenRecord.status === 'USED') {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'This delivery receipt token has already been confirmed and completed.');
  }

  if (new Date(tokenRecord.expiresAt) <= new Date()) {
    throw new ApiError(410, 'EXPIRED', 'Receipt token has expired.');
  }

  const donation = await Donation.findById(tokenRecord.donationId).populate('donorId', 'name phone organization');
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Donation record not found.');
  }

  resetRateLimit(rateLimitKey);

  await AuditLog.create({
    action: 'RECEIPT_SCAN_ATTEMPT',
    donationId: donation._id.toString(),
    stage: 'RECEIPT',
    userId: req.user?._id?.toString() || 'recipient',
    userRole: 'recipient',
    ip: req.ip,
    success: true,
    reason: 'Receipt QR validated successfully. Awaiting recipient confirmation.',
  });

  return res.status(200).json({
    success: true,
    message: 'Delivery QR verified! Please inspect food and confirm receipt.',
    tokenRecord: {
      id: tokenRecord._id,
      donationId: donation._id,
      stage: tokenRecord.stage,
      expiresAt: tokenRecord.expiresAt,
    },
    donation: {
      id: donation._id,
      foodName: donation.foodName,
      donorName: donation.donorId?.name || 'Verified Donor Kitchen',
      totalQuantity: donation.totalQuantity,
      remainingQuantity: donation.remainingQuantity,
      unit: donation.unit,
      status: donation.status,
    },
  });
});

/**
 * Stage 3: Recipient confirms receipt & completion
 */
const confirmReceipt = asyncHandler(async (req, res) => {
  const { tokenId, token: rawToken, receivedQuantity, foodCondition = 'EXCELLENT', discrepancyNotes } = req.body;
  const recipientId = req.user?._id || req.body.recipientId;

  let tokenRecord;
  if (tokenId) {
    tokenRecord = await HandoverToken.findById(tokenId);
  } else if (rawToken) {
    const clean = rawToken.trim();
    tokenRecord = await HandoverToken.findOne({
      $or: [{ rawToken: clean }, { tokenHash: hashToken(clean) }],
    });
  }

  if (!tokenRecord || tokenRecord.stage !== 'RECEIPT') {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Receipt token required to confirm handover.');
  }

  // Atomic consumption of receipt token
  const now = new Date();
  const updatedToken = await HandoverToken.findOneAndUpdate(
    { _id: tokenRecord._id, status: 'ACTIVE' },
    {
      $set: {
        status: 'USED',
        usedAt: now,
        usedByUserId: recipientId || null,
        usedByRole: 'recipient',
      },
    },
    { new: true }
  );

  if (!updatedToken) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Receipt token has already been consumed.');
  }

  const donation = await Donation.findById(tokenRecord.donationId).populate('donorId', 'name organization');
  if (donation) {
    donation.status = DONATION_STATUS.COMPLETED;
    donation.statusHistory.push({
      status: DONATION_STATUS.COMPLETED,
      changedBy: recipientId || null,
      note: discrepancyNotes || `Delivered & Verified. Condition: ${foodCondition}. Quantity: ${receivedQuantity || donation.totalQuantity}`,
      timestamp: now,
    });
    if (donation.acceptances && donation.acceptances.length > 0) {
      donation.acceptances[0].status = ACCEPTANCE_STATUS.COMPLETED;
      donation.acceptances[0].handoverVerifiedAt = now;
      donation.acceptances[0].completedAt = now;
    }
    await donation.save();
  }

  // Generate Digital Handover Receipt with SHA-256 cryptographic proof
  const receiptHash = crypto
    .createHash('sha256')
    .update(`${donation._id}:${recipientId}:${now.toISOString()}:${updatedToken._id}`)
    .digest('hex');

  const handoverReceipt = {
    receiptNumber: `REC-${Date.now().toString(36).toUpperCase()}-${donation._id.toString().slice(-4).toUpperCase()}`,
    donationId: donation._id.toString(),
    foodName: donation.foodName,
    donorName: donation.donorId?.name || 'Verified Kitchen',
    recipientName: req.user?.organization?.name || req.user?.name || 'Shelter Recipient',
    quantityDelivered: `${receivedQuantity || donation.totalQuantity} ${donation.unit}`,
    conditionReport: foodCondition,
    timestamp: now.toISOString(),
    cryptographicProof: receiptHash,
    tokenProofId: updatedToken._id.toString(),
  };

  await AuditLog.create({
    action: 'RECEIPT_CONFIRMED',
    donationId: donation._id.toString(),
    stage: 'RECEIPT',
    userId: recipientId?.toString(),
    userRole: 'recipient',
    ip: req.ip,
    success: true,
    reason: 'Recipient explicitly confirmed physical food delivery. Handover successfully completed.',
    metadata: handoverReceipt,
  });

  broadcastHandoverEvent({
    type: 'RECEIPT_CONFIRMED',
    donationId: donation._id.toString(),
    status: DONATION_STATUS.COMPLETED,
    receipt: handoverReceipt,
  });

  return res.status(200).json({
    success: true,
    message: 'Handover complete! Surplus food successfully delivered and rescued.',
    donation,
    receipt: handoverReceipt,
  });
});

/**
 * Status and audit trail query
 */
const getStatus = asyncHandler(async (req, res) => {
  const { donationId } = req.params;

  let donation;
  if (donationId.match(/^[0-9a-fA-F]{24}$/)) {
    donation = await Donation.findById(donationId);
  } else {
    donation = await Donation.findOne();
  }

  if (!donation) {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Donation not found.');
  }

  const tokens = await HandoverToken.find({ donationId: donation._id }).sort({ createdAt: -1 });
  const audit = await AuditLog.find({ donationId: donation._id.toString() }).sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    donation,
    tokens,
    auditTrail: audit,
  });
});

module.exports = {
  streamEvents,
  getOrCreatePickupToken,
  verifyPickupScan,
  confirmPickup,
  getReceiptToken,
  verifyReceiptScan,
  confirmReceipt,
  getStatus,
  broadcastHandoverEvent,
};
