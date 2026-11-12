const request = require('supertest');
const app = require('../app');
const User = require('../src/models/User');
const { ROLES } = require('../src/constants/roles');
const { REQUIREMENT_STATUS } = require('../src/constants/status');
const ERROR_CODES = require('../src/constants/errorCodes');
const authService = require('../src/services/authService');

describe('Recipient Requirement Management (/api/v1/requirements)', () => {
  let verifiedRecipient, verifiedRecipientToken;
  let unverifiedRecipient, unverifiedRecipientToken;
  let donorUser, donorToken;

  const validRequirementPayload = {
    title: 'Dinner for 50 shelter residents',
    foodType: 'cooked_meals',
    quantityNeeded: 50,
    unit: 'plates',
    dietaryPreference: 'vegetarian',
    neededBy: new Date(Date.now() + 4 * 3600000).toISOString(), // 4h from now
    urgency: 'HIGH',
    location: {
      type: 'Point',
      coordinates: [77.5946, 12.9716],
    },
    address: {
      street: '45 Mission Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560027',
      formattedAddress: '45 Mission Road, Bengaluru, Karnataka 560027',
    },
  };

  beforeEach(async () => {
    // 1. Verified Recipient
    verifiedRecipient = await User.create({
      name: 'Hope Foundation',
      email: 'hope@ngo.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919999000001',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { city: 'Bengaluru', formattedAddress: 'Mission Rd, Bengaluru' },
    });
    verifiedRecipientToken = authService.generateToken(verifiedRecipient._id);

    // 2. Unverified Recipient
    unverifiedRecipient = await User.create({
      name: 'New Shelter',
      email: 'unverified@ngo.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919999000002',
      isVerified: false,
      isActive: true,
      location: { type: 'Point', coordinates: [77.6, 12.9] },
      address: { city: 'Bengaluru', formattedAddress: 'Koramangala, Bengaluru' },
    });
    unverifiedRecipientToken = authService.generateToken(unverifiedRecipient._id);

    // 3. Donor
    donorUser = await User.create({
      name: 'Hotel Plaza',
      email: 'plaza@hotel.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919999000003',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.61, 12.91] },
      address: { city: 'Bengaluru', formattedAddress: 'Jayanagar, Bengaluru' },
    });
    donorToken = authService.generateToken(donorUser._id);
  });

  describe('POST /api/v1/requirements', () => {
    it('should create requirement successfully with status OPEN for verified recipient', async () => {
      const res = await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${verifiedRecipientToken}`)
        .send(validRequirementPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('OPEN');
      expect(res.body.data.title).toBe(validRequirementPayload.title);
      expect(res.body.data.quantityNeeded).toBe(validRequirementPayload.quantityNeeded);
    });

    it('should block unverified recipient from creating requirement with 403 UNVERIFIED_ACCOUNT', async () => {
      const res = await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${unverifiedRecipientToken}`)
        .send(validRequirementPayload);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.UNVERIFIED_ACCOUNT);
    });

    it('should block donor from creating requirements with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(validRequirementPayload);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('GET /api/v1/requirements', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${verifiedRecipientToken}`)
        .send(validRequirementPayload);
    });

    it('should list open requirements and mask exact street address for unattached users', async () => {
      const res = await request(app)
        .get('/api/v1/requirements')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].address.street).toBeNull(); // Masked
      expect(res.body.data[0].address.city).toBe('Bengaluru');
    });

    it('should support filtering requirements by status enum (e.g. OPEN, PARTIALLY_FULFILLED, FULFILLED)', async () => {
      const RecipientRequirement = require('../src/models/RecipientRequirement');
      // Create a fulfilled requirement
      await RecipientRequirement.create({
        ...validRequirementPayload,
        title: 'Fulfilled meal request',
        status: REQUIREMENT_STATUS.FULFILLED,
        recipientId: verifiedRecipient._id,
      });

      const res = await request(app)
        .get(`/api/v1/requirements?status=${REQUIREMENT_STATUS.OPEN}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((r) => r.status === REQUIREMENT_STATUS.OPEN)).toBe(true);
    });
  });
});
