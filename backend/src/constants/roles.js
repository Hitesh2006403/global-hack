const ROLES = Object.freeze({
  DONOR: 'donor',
  RECIPIENT: 'recipient',
  DELIVERY_AGENT: 'delivery_agent',
  ADMIN: 'admin',
});

// Roles allowed for self-registration via public API (Admin accounts are created strictly by seed/admin)
const PUBLIC_REGISTRATION_ROLES = Object.freeze([
  ROLES.DONOR,
  ROLES.RECIPIENT,
  ROLES.DELIVERY_AGENT,
]);

module.exports = {
  ROLES,
  PUBLIC_REGISTRATION_ROLES,
};
