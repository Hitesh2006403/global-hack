const { DONATION_STATUS, FINAL_DONATION_STATUSES } = require('../constants/status');
const { ROLES } = require('../constants/roles');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * State Transition Matrix for food donations.
 * Defines permitted target states and authorized trigger roles.
 */
const TRANSITION_RULES = Object.freeze({
  [DONATION_STATUS.AVAILABLE]: {
    [DONATION_STATUS.PARTIALLY_ACCEPTED]: [ROLES.RECIPIENT, ROLES.ADMIN],
    [DONATION_STATUS.ACCEPTED]: [ROLES.RECIPIENT, ROLES.ADMIN],
    [DONATION_STATUS.CANCELLED]: [ROLES.DONOR, ROLES.ADMIN],
    [DONATION_STATUS.EXPIRED]: [ROLES.ADMIN, 'system'],
  },
  [DONATION_STATUS.PARTIALLY_ACCEPTED]: {
    [DONATION_STATUS.PARTIALLY_ACCEPTED]: [ROLES.RECIPIENT, ROLES.ADMIN],
    [DONATION_STATUS.ACCEPTED]: [ROLES.RECIPIENT, ROLES.ADMIN],
    [DONATION_STATUS.REOPENED]: [ROLES.RECIPIENT, ROLES.ADMIN, 'system'],
    [DONATION_STATUS.CANCELLED]: [ROLES.DONOR, ROLES.ADMIN],
    [DONATION_STATUS.EXPIRED]: [ROLES.ADMIN, 'system'],
  },
  [DONATION_STATUS.ACCEPTED]: {
    [DONATION_STATUS.PICKUP_SCHEDULED]: [ROLES.DELIVERY_AGENT, ROLES.RECIPIENT, ROLES.ADMIN],
    [DONATION_STATUS.REMATCHING]: [ROLES.ADMIN, 'system'],
    [DONATION_STATUS.EXPIRED]: [ROLES.ADMIN, 'system'],
  },
  [DONATION_STATUS.PICKUP_SCHEDULED]: {
    [DONATION_STATUS.PICKED_UP]: [ROLES.DELIVERY_AGENT, ROLES.ADMIN],
    [DONATION_STATUS.REMATCHING]: [ROLES.ADMIN, 'system'],
    [DONATION_STATUS.EXPIRED]: [ROLES.ADMIN, 'system'],
  },
  [DONATION_STATUS.PICKED_UP]: {
    [DONATION_STATUS.HANDOVER_VERIFIED]: [ROLES.DELIVERY_AGENT, ROLES.RECIPIENT, ROLES.ADMIN],
    // Once picked up, food is in physical transit; it cannot transition to EXPIRED
  },
  [DONATION_STATUS.HANDOVER_VERIFIED]: {
    [DONATION_STATUS.COMPLETED]: [ROLES.RECIPIENT, ROLES.ADMIN],
  },
  [DONATION_STATUS.REOPENED]: {
    [DONATION_STATUS.PARTIALLY_ACCEPTED]: [ROLES.RECIPIENT, ROLES.ADMIN],
    [DONATION_STATUS.ACCEPTED]: [ROLES.RECIPIENT, ROLES.ADMIN],
    [DONATION_STATUS.CANCELLED]: [ROLES.DONOR, ROLES.ADMIN],
    [DONATION_STATUS.EXPIRED]: [ROLES.ADMIN, 'system'],
  },
  [DONATION_STATUS.REMATCHING]: {
    [DONATION_STATUS.AVAILABLE]: [ROLES.ADMIN, 'system'],
    [DONATION_STATUS.REOPENED]: [ROLES.ADMIN, 'system'],
    [DONATION_STATUS.EXPIRED]: [ROLES.ADMIN, 'system'],
  },
  [DONATION_STATUS.COMPLETED]: {},
  [DONATION_STATUS.CANCELLED]: {},
  [DONATION_STATUS.EXPIRED]: {},
});

/**
 * Validates that a requested state transition is legally permissible for the given user role.
 *
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Proposed new status
 * @param {string} userRole - Role of actor triggering transition
 * @throws {ApiError} 409 INVALID_STATUS_TRANSITION if transition is illegal
 */
const assertTransition = (fromStatus, toStatus, userRole) => {
  if (FINAL_DONATION_STATUSES.includes(fromStatus)) {
    throw new ApiError(
      409,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Cannot transition from terminal status '${fromStatus}'`
    );
  }

  const allowedTargets = TRANSITION_RULES[fromStatus];
  if (!allowedTargets || !allowedTargets[toStatus]) {
    throw new ApiError(
      409,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Illegal status transition from '${fromStatus}' to '${toStatus}'`
    );
  }

  const allowedRoles = allowedTargets[toStatus];
  if (userRole && !allowedRoles.includes(userRole)) {
    throw new ApiError(
      403,
      ERROR_CODES.FORBIDDEN,
      `Role '${userRole}' is not authorized to transition from '${fromStatus}' to '${toStatus}'`
    );
  }
};

/**
 * Appends a state transition entry to a donation's statusHistory array.
 *
 * @param {Object} donation - Mongoose Donation document
 * @param {string} newStatus - New status
 * @param {string|mongoose.Types.ObjectId} [changedBy=null] - Actor who changed status
 * @param {string} [note=null] - Human readable transition note
 */
const appendHistory = (donation, newStatus, changedBy = null, note = null) => {
  donation.status = newStatus;
  donation.statusHistory.push({
    status: newStatus,
    changedBy: changedBy ? changedBy : null,
    note: note || `Status changed to ${newStatus}`,
    timestamp: new Date(),
  });
};

/**
 * Computes whether a donation has crossed its effective safe consumption threshold.
 *
 * @param {Object} donation - Donation document or plain object with expiryAt and safetyBufferMinutes
 * @param {Date} [now=new Date()] - Evaluation time
 * @returns {boolean}
 */
const isExpired = (donation, now = new Date()) => {
  if (!donation.expiryAt) return false;
  const bufferMs = (donation.safetyBufferMinutes || 60) * 60000;
  const effectiveExpiryAt = new Date(donation.expiryAt.getTime() - bufferMs);
  return now >= effectiveExpiryAt;
};

/**
 * Computes live countdown metrics and urgency classification.
 *
 * @param {Object} donation - Donation document or plain object
 * @param {Date} [now=new Date()] - Evaluation time
 * @returns {{ secondsToEffectiveExpiry: number, urgencyLevel: 'CRITICAL'|'URGENT'|'NORMAL'|'EXPIRED' }}
 */
const computeCountdown = (donation, now = new Date()) => {
  if (!donation.expiryAt) {
    return { secondsToEffectiveExpiry: 0, urgencyLevel: 'NORMAL' };
  }

  const bufferMs = (donation.safetyBufferMinutes || 60) * 60000;
  const effectiveExpiryAt = new Date(donation.expiryAt.getTime() - bufferMs);
  const diffMs = effectiveExpiryAt.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { secondsToEffectiveExpiry: 0, urgencyLevel: 'EXPIRED' };
  }

  const secondsToEffectiveExpiry = Math.floor(diffMs / 1000);

  let urgencyLevel = 'NORMAL';
  if (secondsToEffectiveExpiry < 3600) {
    urgencyLevel = 'CRITICAL'; // Under 1 hour
  } else if (secondsToEffectiveExpiry < 10800) {
    urgencyLevel = 'URGENT'; // 1 to 3 hours
  }

  return {
    secondsToEffectiveExpiry,
    urgencyLevel,
  };
};

/**
 * Derives aggregate donation-level status from remaining quantity and acceptance subdocuments.
 * Implements the aggregate status derivation rule defined in docs/API.md:
 * 1. If remainingQuantity === totalQuantity with 0 active acceptances:
 *    - If previously cancelled, rematched, or reopened -> REOPENED
 *    - Otherwise -> AVAILABLE
 * 2. If 0 < remainingQuantity < totalQuantity (with active acceptances) -> PARTIALLY_ACCEPTED
 * 3. If remainingQuantity === 0:
 *    - If all active acceptances are COMPLETED -> COMPLETED
 *    - If any active acceptance is in progress:
 *      - If any is HANDOVER_VERIFIED -> HANDOVER_VERIFIED
 *      - Else if any is PICKED_UP -> PICKED_UP
 *      - Else if any is PICKUP_SCHEDULED -> PICKUP_SCHEDULED
 *      - Else -> ACCEPTED
 * 4. If all acceptances are CANCELLED and no active portions exist -> REOPENED
 *
 * @param {Array<Object>} [acceptances=[]] - List of acceptance subdocuments
 * @param {number} remainingQuantity - Currently unallocated quantity
 * @param {string} [currentStatus=null] - Current donation status for context
 * @returns {string} Derived donation-level DONATION_STATUS enum
 */
const deriveDonationStatus = (acceptances = [], remainingQuantity = 0, currentStatus = null) => {
  const accList = Array.isArray(acceptances) ? acceptances : [];
  const activeAcceptances = accList.filter(
    (a) => a.status !== 'CANCELLED' && a.status !== 'REJECTED_UNSAFE'
  );

  // Rule 4: If acceptances exist and all are CANCELLED, restore to REOPENED
  if (accList.length > 0 && activeAcceptances.length === 0) {
    return DONATION_STATUS.REOPENED;
  }

  // Rule 1: No active acceptances
  if (activeAcceptances.length === 0) {
    if (
      currentStatus === DONATION_STATUS.REOPENED ||
      currentStatus === DONATION_STATUS.REMATCHING ||
      currentStatus === DONATION_STATUS.CANCELLED
    ) {
      return DONATION_STATUS.REOPENED;
    }
    return DONATION_STATUS.AVAILABLE;
  }

  // Rule 2: Partial remaining quantity
  if (remainingQuantity > 0) {
    return DONATION_STATUS.PARTIALLY_ACCEPTED;
  }

  // Rule 3: remainingQuantity === 0
  if (activeAcceptances.every((a) => a.status === 'COMPLETED')) {
    return DONATION_STATUS.COMPLETED;
  }

  if (activeAcceptances.some((a) => a.status === 'HANDOVER_VERIFIED')) {
    return DONATION_STATUS.HANDOVER_VERIFIED;
  }

  if (activeAcceptances.some((a) => a.status === 'PICKED_UP')) {
    return DONATION_STATUS.PICKED_UP;
  }

  if (activeAcceptances.some((a) => a.status === 'PICKUP_SCHEDULED')) {
    return DONATION_STATUS.PICKUP_SCHEDULED;
  }

  return DONATION_STATUS.ACCEPTED;
};

module.exports = {
  TRANSITION_RULES,
  assertTransition,
  appendHistory,
  isExpired,
  computeCountdown,
  deriveDonationStatus,
};
