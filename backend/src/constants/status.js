// Aggregate donation-level lifecycle status
const DONATION_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',                   // Open for matching/acceptance
  PARTIALLY_ACCEPTED: 'PARTIALLY_ACCEPTED', // Part claimed, remainder open
  ACCEPTED: 'ACCEPTED',                     // 100% quantity claimed
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',     // Logistics window created
  PICKED_UP: 'PICKED_UP',                   // Food collected, in transit
  HANDOVER_VERIFIED: 'HANDOVER_VERIFIED',   // QR verified at drop-off
  COMPLETED: 'COMPLETED',                   // Delivered + safety verified [FINAL]
  CANCELLED: 'CANCELLED',                   // Revoked by donor before pickup [FINAL]
  REOPENED: 'REOPENED',                     // Reopened after cancellation/rematch
  EXPIRED: 'EXPIRED',                       // Passed effective expiry [FINAL]
  REMATCHING: 'REMATCHING',                 // Automated rematching active
});

// Acceptance-level sub-record lifecycle status (Member 3 & 4)
const ACCEPTANCE_STATUS = Object.freeze({
  CLAIMED: 'CLAIMED',                       // Claim placed by recipient
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',     // Logistics window set
  PICKED_UP: 'PICKED_UP',                   // Collected from donor
  HANDOVER_VERIFIED: 'HANDOVER_VERIFIED',   // QR verified at recipient site
  COMPLETED: 'COMPLETED',                   // Final safety check passed [FINAL]
  CANCELLED: 'CANCELLED',                   // Cancelled before pickup [FINAL]
  REJECTED_UNSAFE: 'REJECTED_UNSAFE',       // Failed safety check; compost/disposal [FINAL]
});

// Terminal states that cannot transition further
const FINAL_DONATION_STATUSES = Object.freeze([
  DONATION_STATUS.COMPLETED,
  DONATION_STATUS.CANCELLED,
  DONATION_STATUS.EXPIRED,
]);

const FINAL_ACCEPTANCE_STATUSES = Object.freeze([
  ACCEPTANCE_STATUS.COMPLETED,
  ACCEPTANCE_STATUS.CANCELLED,
  ACCEPTANCE_STATUS.REJECTED_UNSAFE,
]);

// Recipient requirement lifecycle status
const REQUIREMENT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  PARTIALLY_FULFILLED: 'PARTIALLY_FULFILLED',
  FULFILLED: 'FULFILLED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

// Alias for backwards-compatibility with docs
const FINAL_STATUSES = FINAL_DONATION_STATUSES;

module.exports = {
  DONATION_STATUS,
  ACCEPTANCE_STATUS,
  REQUIREMENT_STATUS,
  FINAL_DONATION_STATUSES,
  FINAL_ACCEPTANCE_STATUSES,
  FINAL_STATUSES,
};
