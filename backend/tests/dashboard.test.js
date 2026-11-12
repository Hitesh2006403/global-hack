const request = require('supertest');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const RecipientRequirement = require('../src/models/RecipientRequirement');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS, ACCEPTANCE_STATUS, REQUIREMENT_STATUS } = require('../src/constants/status');
const ERROR_CODES = require('../src/constants/errorCodes');
const authService = require('../src/services/authService');

describe('Dashboard Analytics & Impact Metrics (/api/v1/dashboard)', () => {
  let donorUser, donorToken;
  let recipientUser, recipientToken;
  let unverifiedRecipientUser, unverifiedRecipientToken;

  beforeEach(async () => {
    // 1. Donor
    donorUser = await User.create({
      name: 'Chef Community',
      email: 'chef@community.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919111111111',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Chef Kitchen' },
    });
    donorToken = authService.generateToken(donorUser._id);

    // 2. Verified Recipient
    recipientUser = await User.create({
      name: 'City Care Orphanage',
      email: 'care@city.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919222222222',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.6, 12.98] },
      address: { city: 'Bengaluru', formattedAddress: 'City Care' },
    });
    recipientToken = authService.generateToken(recipientUser._id);

    // 3. Unverified Recipient
    unverifiedRecipientUser = await User.create({
      name: 'Pending Recipient',
      email: 'pending@recipient.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919333333333',
      isVerified: false,
      isActive: true,
      location: { type: 'Point', coordinates: [77.61, 12.99] },
      address: { city: 'Bengaluru', formattedAddress: 'Pending Site' },
    });
    unverifiedRecipientToken = authService.generateToken(unverifiedRecipientUser._id);
  });

  describe('GET /api/v1/dashboard/impact (Public)', () => {
    it('should be reachable without authentication token and contain NO PII (no names, phones, or emails)', async () => {
      const res = await request(app).get('/api/v1/dashboard/impact');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const jsonStr = JSON.stringify(res.body.data);
      expect(jsonStr).not.toContain('chef@community.org');
      expect(jsonStr).not.toContain('care@city.org');
      expect(jsonStr).not.toContain('+919111111111');
      expect(jsonStr).not.toContain('Chef Community');
      expect(jsonStr).not.toContain('City Care Orphanage');

      expect(res.body.data.mealsSaved).toBeDefined();
      expect(res.body.data.totalDonationsCompleted).toBeDefined();
      expect(res.body.data.activeDonationsCount).toBeDefined();
      expect(res.body.data.percentCompletedBeforeExpiry).toBeDefined();
      expect(res.body.data.registeredDonorsCount).toBeDefined();
      expect(res.body.data.registeredRecipientsCount).toBeDefined();
      expect(res.body.data.registeredDonors).toBeUndefined();
      expect(res.body.data.registeredRecipients).toBeUndefined();
    });

    it('should accurately calculate mealsSaved, completion percentages, and average time to match on seeded data', async () => {
      const now = new Date();
      const pastCreated = new Date(now.getTime() - 20 * 60 * 1000); // Created 20m ago
      const claimedAt = new Date(now.getTime() - 10 * 60 * 1000); // Claimed 10m later -> diff = 10 minutes

      // Donation 1: Completed with 20 plates (= 20 meals), handover before expiry
      await Donation.create({
        donorId: donorUser._id,
        foodName: 'Completed Meals Donation',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 20,
        remainingQuantity: 0,
        unit: 'plates',
        cookedAt: pastCreated,
        createdAt: pastCreated,
        expiryAt: new Date(now.getTime() + 2 * 3600000), // Expiry 2h ahead
        safetyBufferMinutes: 30,
        pickupWindowStart: pastCreated,
        pickupWindowEnd: new Date(now.getTime() + 3600000),
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        address: { city: 'Bengaluru', formattedAddress: 'Kitchen' },
        status: DONATION_STATUS.COMPLETED,
        acceptances: [
          {
            recipientId: recipientUser._id,
            quantity: 20,
            status: ACCEPTANCE_STATUS.COMPLETED,
            claimedAt,
            handoverVerifiedAt: new Date(now.getTime() - 5 * 60 * 1000), // before effectiveExpiry
            completedAt: new Date(now.getTime() - 4 * 60 * 1000),
          },
        ],
      });

      // Donation 2: Completed with 10 kg (= 25 meals), handover after expiry (expired delivery)
      const expiredPastExpiry = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
      await Donation.create({
        donorId: donorUser._id,
        foodName: 'Completed Kg Food',
        foodType: 'raw_groceries',
        dietaryType: 'vegetarian',
        totalQuantity: 10,
        remainingQuantity: 0,
        unit: 'kg',
        cookedAt: pastCreated,
        createdAt: pastCreated,
        expiryAt: expiredPastExpiry,
        safetyBufferMinutes: 15,
        pickupWindowStart: pastCreated,
        pickupWindowEnd: expiredPastExpiry,
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        address: { city: 'Bengaluru', formattedAddress: 'Kitchen' },
        status: DONATION_STATUS.COMPLETED,
        acceptances: [
          {
            recipientId: recipientUser._id,
            quantity: 10,
            status: ACCEPTANCE_STATUS.COMPLETED,
            claimedAt: new Date(now.getTime() - 15 * 60 * 1000),
            handoverVerifiedAt: now, // after effective expiry
            completedAt: now,
          },
        ],
      });

      const res = await request(app).get('/api/v1/dashboard/impact');
      expect(res.status).toBe(200);

      // mealsSaved = 20 plates * 1.0 + 10 kg * 2.5 = 20 + 25 = 45 meals
      expect(res.body.data.mealsSaved).toBe(45);
      expect(res.body.data.totalDonationsCompleted).toBe(2);

      // 1 out of 2 completed acceptances had handover before effective expiry -> 50.0%
      expect(res.body.data.percentCompletedBeforeExpiry).toBe(50);

      // Average time to match:
      // Donation 1: claimedAt - createdAt = 10m
      // Donation 2: claimedAt - createdAt = 5m
      // Average: (10 + 5) / 2 = 7.5m
      expect(res.body.data.avgTimeToMatchMinutes).toBeCloseTo(7.5, 1);

      // Registered users: 1 donor, 1 verified recipient (pending recipient excluded from registeredRecipientsCount)
      expect(res.body.data.registeredDonorsCount).toBe(1);
      expect(res.body.data.registeredRecipientsCount).toBe(1);
      expect(res.body.data.registeredDonors).toBeUndefined();
      expect(res.body.data.registeredRecipients).toBeUndefined();
    });

    it('should serve cached response within 60s when enabled outside test mode', async () => {
      const dashboardController = require('../src/controllers/dashboardController');
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        // Seed mock cache
        dashboardController._setImpactCache(
          { mealsSaved: 9999, registeredDonorsCount: 42, registeredRecipientsCount: 24 },
          Date.now()
        );

        const res = await request(app).get('/api/v1/dashboard/impact');
        expect(res.status).toBe(200);
        expect(res.body.data.mealsSaved).toBe(9999);
      } finally {
        process.env.NODE_ENV = originalEnv;
        dashboardController._setImpactCache(null, 0);
      }
    });
  });

  describe('GET /api/v1/dashboard/donor', () => {
    it('should reject recipient calling donor dashboard with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/donor')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should return donor analytics including status counts, meals contributed, and last 5 donations', async () => {
      const now = new Date();
      await Donation.create({
        donorId: donorUser._id,
        foodName: 'Donor Dashboard Item',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 30,
        remainingQuantity: 30,
        unit: 'plates',
        cookedAt: now,
        expiryAt: new Date(now.getTime() + 3600000),
        safetyBufferMinutes: 30,
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 1800000),
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        address: { city: 'Bengaluru', formattedAddress: 'Kitchen' },
        status: DONATION_STATUS.AVAILABLE,
      });

      const res = await request(app)
        .get('/api/v1/dashboard/donor')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.countsPerStatus).toBeDefined();
      expect(res.body.data.countsPerStatus.AVAILABLE).toBe(1);
      expect(res.body.data.last5Donations.length).toBe(1);
      expect(res.body.data.last5Donations[0].foodName).toBe('Donor Dashboard Item');
    });
  });

  describe('GET /api/v1/dashboard/recipient', () => {
    it('should block unverified recipient with 403 UNVERIFIED_ACCOUNT', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/recipient')
        .set('Authorization', `Bearer ${unverifiedRecipientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.UNVERIFIED_ACCOUNT);
    });

    it('should return recipient demand & claims stats for verified recipient', async () => {
      await RecipientRequirement.create({
        recipientId: recipientUser._id,
        title: 'Requirement for 40',
        foodType: 'cooked_meals',
        quantityNeeded: 40,
        unit: 'plates',
        neededBy: new Date(Date.now() + 3600000),
        status: REQUIREMENT_STATUS.OPEN,
        location: { type: 'Point', coordinates: [77.6, 12.98] },
        address: { city: 'Bengaluru', formattedAddress: 'Site' },
      });

      const res = await request(app)
        .get('/api/v1/dashboard/recipient')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.countsPerStatus).toBeDefined();
      expect(res.body.data.countsPerStatus.OPEN).toBe(1);
      expect(res.body.data.totalAcceptedQuantity).toBe(0);
      expect(res.body.data.completedMeals).toBe(0);
      expect(Array.isArray(res.body.data.last5Acceptances)).toBe(true);
    });
  });
});
