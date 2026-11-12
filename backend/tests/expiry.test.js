const request = require('supertest');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS } = require('../src/constants/status');
const { sweepExpiredDonations } = require('../src/services/expirySweeper');
const authService = require('../src/services/authService');

describe('Donation Expiry & Sweeper Service', () => {
  let donorUser, donorToken;

  beforeEach(async () => {
    donorUser = await User.create({
      name: 'Central Kitchen',
      email: 'kitchen@central.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919999000111',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Central Kitchen' },
    });
    donorToken = authService.generateToken(donorUser._id);
  });

  it('should sweep expired pre-pickup donations but NEVER sweep PICKED_UP donations', async () => {
    const pastTime = new Date(Date.now() - 3600000); // 1 hour in the past

    // 1. Expired AVAILABLE donation
    const expiredAvailable = await Donation.create({
      donorId: donorUser._id,
      foodName: 'Expired Available Food',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 20,
      remainingQuantity: 20,
      unit: 'plates',
      cookedAt: new Date(Date.now() - 7200000),
      expiryAt: pastTime,
      safetyBufferMinutes: 15,
      pickupWindowStart: new Date(Date.now() - 7200000),
      pickupWindowEnd: pastTime,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Central Kitchen' },
      status: DONATION_STATUS.AVAILABLE,
    });

    // 2. Expired ACCEPTED donation
    const expiredAccepted = await Donation.create({
      donorId: donorUser._id,
      foodName: 'Expired Accepted Food',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 20,
      remainingQuantity: 0,
      unit: 'plates',
      cookedAt: new Date(Date.now() - 7200000),
      expiryAt: pastTime,
      safetyBufferMinutes: 15,
      pickupWindowStart: new Date(Date.now() - 7200000),
      pickupWindowEnd: pastTime,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Central Kitchen' },
      status: DONATION_STATUS.ACCEPTED,
    });

    // 3. Expired PICKED_UP donation (Physical food in transit!)
    const expiredPickedUp = await Donation.create({
      donorId: donorUser._id,
      foodName: 'In-Transit Food',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 20,
      remainingQuantity: 0,
      unit: 'plates',
      cookedAt: new Date(Date.now() - 7200000),
      expiryAt: pastTime,
      safetyBufferMinutes: 15,
      pickupWindowStart: new Date(Date.now() - 7200000),
      pickupWindowEnd: pastTime,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Central Kitchen' },
      status: DONATION_STATUS.PICKED_UP,
    });

    // Run sweeper
    const { modifiedCount } = await sweepExpiredDonations();
    expect(modifiedCount).toBe(2);

    const d1 = await Donation.findById(expiredAvailable._id);
    const d2 = await Donation.findById(expiredAccepted._id);
    const d3 = await Donation.findById(expiredPickedUp._id);

    expect(d1.status).toBe(DONATION_STATUS.EXPIRED);
    expect(d2.status).toBe(DONATION_STATUS.EXPIRED);
    expect(d3.status).toBe(DONATION_STATUS.PICKED_UP); // Preserved! Never marked EXPIRED
  });

  it('should lazily mark a donation EXPIRED when queried via GET /donations/:id', async () => {
    const pastTime = new Date(Date.now() - 10000); // 10s in the past

    const donation = await Donation.create({
      donorId: donorUser._id,
      foodName: 'About to expire food',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 25,
      remainingQuantity: 25,
      unit: 'plates',
      cookedAt: new Date(Date.now() - 3600000),
      expiryAt: pastTime,
      safetyBufferMinutes: 15,
      pickupWindowStart: new Date(Date.now() - 3600000),
      pickupWindowEnd: pastTime,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Central Kitchen' },
      status: DONATION_STATUS.AVAILABLE,
    });

    const res = await request(app)
      .get(`/api/v1/donations/${donation._id}`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(DONATION_STATUS.EXPIRED);

    // Verify persisted in DB
    const persisted = await Donation.findById(donation._id);
    expect(persisted.status).toBe(DONATION_STATUS.EXPIRED);
  });

  it('should cancel active acceptances (CLAIMED, PICKUP_SCHEDULED) with note "expired" on sweep and lazy expiry, but never touch COMPLETED or PICKED_UP', async () => {
    const pastTime = new Date(Date.now() - 3600000);
    const recipientUser = await User.create({
      name: 'Recipient Shelter',
      email: 'shelter@recipient.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919999000222',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.6, 12.98] },
      address: { city: 'Bengaluru', formattedAddress: 'Shelter' },
    });

    // 1. Donation with active acceptances before sweep
    const sweepTarget = await Donation.create({
      donorId: donorUser._id,
      foodName: 'Sweep Target with Claims',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 50,
      remainingQuantity: 0,
      unit: 'plates',
      cookedAt: new Date(Date.now() - 7200000),
      expiryAt: pastTime,
      safetyBufferMinutes: 15,
      pickupWindowStart: new Date(Date.now() - 7200000),
      pickupWindowEnd: pastTime,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Central Kitchen' },
      status: DONATION_STATUS.ACCEPTED,
      acceptances: [
        {
          recipientId: recipientUser._id,
          quantity: 20,
          status: 'CLAIMED',
        },
        {
          recipientId: recipientUser._id,
          quantity: 30,
          status: 'PICKUP_SCHEDULED',
        },
      ],
      statusHistory: [
        { status: DONATION_STATUS.AVAILABLE, note: 'Initial post' },
        { status: DONATION_STATUS.ACCEPTED, note: 'Fully claimed' },
      ],
    });

    const initialHistoryLength = sweepTarget.statusHistory.length;

    // Run sweeper
    await sweepExpiredDonations();

    const swept = await Donation.findById(sweepTarget._id);
    expect(swept.status).toBe(DONATION_STATUS.EXPIRED);
    expect(swept.statusHistory.length).toBe(initialHistoryLength + 1); // Exactly one entry added
    expect(swept.statusHistory[swept.statusHistory.length - 1].status).toBe(DONATION_STATUS.EXPIRED);

    // Both active acceptances cancelled with note "expired"
    expect(swept.acceptances[0].status).toBe('CANCELLED');
    expect(swept.acceptances[0].notes).toBe('expired');
    expect(swept.acceptances[1].status).toBe('CANCELLED');
    expect(swept.acceptances[1].notes).toBe('expired');

    // 2. Donation tested with lazy expiry via GET /donations/:id
    const lazyTarget = await Donation.create({
      donorId: donorUser._id,
      foodName: 'Lazy Expiry Target with Claim',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 30,
      remainingQuantity: 10,
      unit: 'plates',
      cookedAt: new Date(Date.now() - 7200000),
      expiryAt: pastTime,
      safetyBufferMinutes: 15,
      pickupWindowStart: new Date(Date.now() - 7200000),
      pickupWindowEnd: pastTime,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Central Kitchen' },
      status: DONATION_STATUS.PARTIALLY_ACCEPTED,
      acceptances: [
        {
          recipientId: recipientUser._id,
          quantity: 20,
          status: 'CLAIMED',
        },
      ],
      statusHistory: [{ status: DONATION_STATUS.AVAILABLE, note: 'Initial' }],
    });

    const res = await request(app)
      .get(`/api/v1/donations/${lazyTarget._id}`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(DONATION_STATUS.EXPIRED);

    const lazilyUpdated = await Donation.findById(lazyTarget._id);
    expect(lazilyUpdated.status).toBe(DONATION_STATUS.EXPIRED);
    expect(lazilyUpdated.acceptances[0].status).toBe('CANCELLED');
    expect(lazilyUpdated.acceptances[0].notes).toBe('expired');
    expect(lazilyUpdated.statusHistory.length).toBe(2);
  });
});
