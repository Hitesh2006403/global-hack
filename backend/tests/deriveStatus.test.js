const { deriveDonationStatus } = require('../src/services/donationStateService');
const { DONATION_STATUS, ACCEPTANCE_STATUS } = require('../src/constants/status');

describe('deriveDonationStatus Unit Tests (State Aggregation Rules)', () => {
  // Scenario 1: Nothing accepted
  it('should derive AVAILABLE when nothing is accepted and remaining equals total quantity', () => {
    const status = deriveDonationStatus([], 50, DONATION_STATUS.AVAILABLE);
    expect(status).toBe(DONATION_STATUS.AVAILABLE);
  });

  // Scenario 2: Partial acceptance
  it('should derive PARTIALLY_ACCEPTED when some quantity remains and active acceptances exist', () => {
    const acceptances = [
      { status: ACCEPTANCE_STATUS.CLAIMED, quantity: 20 },
    ];
    const status = deriveDonationStatus(acceptances, 30, DONATION_STATUS.AVAILABLE);
    expect(status).toBe(DONATION_STATUS.PARTIALLY_ACCEPTED);
  });

  // Scenario 3: Fully accepted
  it('should derive ACCEPTED when remainingQuantity is 0 and active acceptances are claimed', () => {
    const acceptances = [
      { status: ACCEPTANCE_STATUS.CLAIMED, quantity: 50 },
    ];
    const status = deriveDonationStatus(acceptances, 0, DONATION_STATUS.AVAILABLE);
    expect(status).toBe(DONATION_STATUS.ACCEPTED);
  });

  // Scenario 4: One cancelled acceptance reopens
  it('should derive REOPENED when one cancelled acceptance restores quantity back to full with no active claims', () => {
    const acceptances = [
      { status: ACCEPTANCE_STATUS.CANCELLED, quantity: 50 },
    ];
    const status = deriveDonationStatus(acceptances, 50, DONATION_STATUS.ACCEPTED);
    expect(status).toBe(DONATION_STATUS.REOPENED);
  });

  // Scenario 5: Mixed progress
  it('should derive highest progression status when mixed progress exists across active claims', () => {
    // 5a. PICKED_UP overrides CLAIMED and PICKUP_SCHEDULED
    const mixed1 = [
      { status: ACCEPTANCE_STATUS.CLAIMED, quantity: 20 },
      { status: ACCEPTANCE_STATUS.PICKED_UP, quantity: 30 },
    ];
    expect(deriveDonationStatus(mixed1, 0, DONATION_STATUS.ACCEPTED)).toBe(
      DONATION_STATUS.PICKED_UP
    );

    // 5b. HANDOVER_VERIFIED overrides PICKED_UP
    const mixed2 = [
      { status: ACCEPTANCE_STATUS.PICKED_UP, quantity: 25 },
      { status: ACCEPTANCE_STATUS.HANDOVER_VERIFIED, quantity: 25 },
    ];
    expect(deriveDonationStatus(mixed2, 0, DONATION_STATUS.PICKED_UP)).toBe(
      DONATION_STATUS.HANDOVER_VERIFIED
    );

    // 5c. PICKUP_SCHEDULED when none picked up yet
    const mixed3 = [
      { status: ACCEPTANCE_STATUS.CLAIMED, quantity: 20 },
      { status: ACCEPTANCE_STATUS.PICKUP_SCHEDULED, quantity: 30 },
    ];
    expect(deriveDonationStatus(mixed3, 0, DONATION_STATUS.ACCEPTED)).toBe(
      DONATION_STATUS.PICKUP_SCHEDULED
    );
  });

  // Scenario 6: All completed
  it('should derive COMPLETED when remaining is 0 and all active acceptances are COMPLETED', () => {
    const acceptances = [
      { status: ACCEPTANCE_STATUS.COMPLETED, quantity: 25 },
      { status: ACCEPTANCE_STATUS.COMPLETED, quantity: 25 },
    ];
    const status = deriveDonationStatus(acceptances, 0, DONATION_STATUS.HANDOVER_VERIFIED);
    expect(status).toBe(DONATION_STATUS.COMPLETED);
  });

  // Scenario 7: All cancelled
  it('should derive REOPENED when all acceptances are cancelled and no active portions exist', () => {
    const acceptances = [
      { status: ACCEPTANCE_STATUS.CANCELLED, quantity: 25 },
      { status: ACCEPTANCE_STATUS.CANCELLED, quantity: 25 },
    ];
    const status = deriveDonationStatus(acceptances, 50, DONATION_STATUS.PARTIALLY_ACCEPTED);
    expect(status).toBe(DONATION_STATUS.REOPENED);
  });
});
