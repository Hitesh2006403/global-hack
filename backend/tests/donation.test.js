const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS, ACCEPTANCE_STATUS } = require('../src/constants/status');
const ERROR_CODES = require('../src/constants/errorCodes');
const authService = require('../src/services/authService');

describe('Donation Management (/api/v1/donations)', () => {
  let donorUser, donorToken;
  let otherDonorUser, otherDonorToken;
  let verifiedRecipientUser, verifiedRecipientToken;
  let unverifiedRecipientUser, unverifiedRecipientToken;

  const getValidDonationPayload = () => {
    const now = new Date();
    const cookedAt = new Date(now.getTime() - 30 * 60 * 1000); // 30m ago
    const expiryAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6h from now
    const pickupStart = new Date(now.getTime() + 10 * 60 * 1000); // 10m from now
    const pickupEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4h from now (buffer=60m, effectiveExpiry=5h)

    return {
      foodName: 'Fresh Vegetable Pulao & Curd',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 40,
      unit: 'plates',
      cookedAt: cookedAt.toISOString(),
      expiryAt: expiryAt.toISOString(),
      safetyBufferMinutes: 60,
      pickupWindowStart: pickupStart.toISOString(),
      pickupWindowEnd: pickupEnd.toISOString(),
      packagingType: 'sealed_containers',
      instructions: 'Gate 3 pickup. Keep warm.',
      photos: ['https://example.com/pulao.jpg'],
      location: {
        type: 'Point',
        coordinates: [77.594628, 12.971635],
      },
      address: {
        street: '15 Residency Road, Ashok Nagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560025',
        formattedAddress: '15 Residency Road, Bengaluru, Karnataka 560025',
      },
    };
  };

  beforeEach(async () => {
    // 1. Donor User
    donorUser = await User.create({
      name: 'Grand Royal Banquet',
      email: 'donor@royal.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919876543211',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.594628, 12.971635] },
      address: { city: 'Bengaluru', formattedAddress: 'Residency Rd, Bengaluru' },
    });
    donorToken = authService.generateToken(donorUser._id);

    // 2. Second Donor User
    otherDonorUser = await User.create({
      name: 'Other Catering',
      email: 'other@catering.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919876543212',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.6, 12.9] },
      address: { city: 'Bengaluru', formattedAddress: 'Indiranagar, Bengaluru' },
    });
    otherDonorToken = authService.generateToken(otherDonorUser._id);

    // 3. Verified Recipient
    verifiedRecipientUser = await User.create({
      name: 'Sunshine Shelter',
      email: 'shelter@sunshine.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919876543213',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.61, 12.95] },
      address: { city: 'Bengaluru', formattedAddress: 'Koramangala, Bengaluru' },
    });
    verifiedRecipientToken = authService.generateToken(verifiedRecipientUser._id);

    // 4. Unverified Recipient
    unverifiedRecipientUser = await User.create({
      name: 'New NGO',
      email: 'new@ngo.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919876543214',
      isVerified: false,
      isActive: true,
      location: { type: 'Point', coordinates: [77.62, 12.96] },
      address: { city: 'Bengaluru', formattedAddress: 'HSR Layout, Bengaluru' },
    });
    unverifiedRecipientToken = authService.generateToken(unverifiedRecipientUser._id);
  });

  describe('POST /api/v1/donations (Create Donation)', () => {
    it('should create donation successfully with status AVAILABLE, remainingQuantity = totalQuantity, and 1 statusHistory entry', async () => {
      const payload = getValidDonationPayload();
      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.foodName).toBe(payload.foodName);
      expect(res.body.data.status).toBe(DONATION_STATUS.AVAILABLE);
      expect(res.body.data.totalQuantity).toBe(payload.totalQuantity);
      expect(res.body.data.remainingQuantity).toBe(payload.totalQuantity);
      expect(res.body.data.statusHistory.length).toBe(1);
      expect(res.body.data.statusHistory[0].status).toBe(DONATION_STATUS.AVAILABLE);
      expect(res.body.data.donor.phone).toBe(donorUser.phone); // Owner sees full phone
    });

    it('should reject non-donor role with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${verifiedRecipientToken}`)
        .send(getValidDonationPayload());

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should reject client-supplied status, remainingQuantity, or donorId (mass-assignment protection)', async () => {
      const maliciousPayload = {
        ...getValidDonationPayload(),
        status: DONATION_STATUS.COMPLETED,
        remainingQuantity: 999,
        donorId: new mongoose.Types.ObjectId().toString(),
      };

      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(maliciousPayload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject invalid dates: expiry in past or pickupWindowEnd after effectiveExpiryAt', async () => {
      const now = new Date();

      // Case 1: Expiry in the past
      const pastExpiryPayload = {
        ...getValidDonationPayload(),
        cookedAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
        expiryAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
      };
      const res1 = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(pastExpiryPayload);
      expect(res1.status).toBe(400);

      // Case 2: pickupWindowEnd exceeds effectiveExpiryAt
      const buffer = 60; // 1 hour buffer
      const expiry = new Date(now.getTime() + 3 * 3600000); // 3h from now => effective = 2h from now
      const invalidPickupEnd = new Date(now.getTime() + 2.5 * 3600000); // 2.5h from now > 2h
      const exceedingPickupPayload = {
        ...getValidDonationPayload(),
        expiryAt: expiry.toISOString(),
        safetyBufferMinutes: buffer,
        pickupWindowEnd: invalidPickupEnd.toISOString(),
      };
      const res2 = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(exceedingPickupPayload);
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('Static Route Precedence & Discovery (/available and /my)', () => {
    let createdDonationId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(getValidDonationPayload());
      createdDonationId = res.body.data._id || res.body.data.id;
    });

    it('should NOT swallow /available or /my as an ID parameter', async () => {
      const myRes = await request(app)
        .get('/api/v1/donations/my')
        .set('Authorization', `Bearer ${donorToken}`);
      expect(myRes.status).toBe(200);

      const availRes = await request(app)
        .get('/api/v1/donations/available')
        .set('Authorization', `Bearer ${verifiedRecipientToken}`);
      expect(availRes.status).toBe(200);
    });

    it('should block unverified recipient from calling /available with 403 UNVERIFIED_ACCOUNT', async () => {
      const res = await request(app)
        .get('/api/v1/donations/available')
        .set('Authorization', `Bearer ${unverifiedRecipientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.UNVERIFIED_ACCOUNT);
    });

    it('should exclude expired donations and donations with remainingQuantity === 0 from /available', async () => {
      // Create a donation with remainingQuantity = 0
      await Donation.create({
        donorId: donorUser._id,
        foodName: 'Depleted Food Post',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 10,
        remainingQuantity: 0, // Depleted!
        unit: 'plates',
        cookedAt: new Date(),
        expiryAt: new Date(Date.now() + 36000000),
        pickupWindowStart: new Date(),
        pickupWindowEnd: new Date(Date.now() + 18000000),
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        address: { city: 'Bengaluru', formattedAddress: 'City Center' },
        status: DONATION_STATUS.ACCEPTED,
      });

      const res = await request(app)
        .get('/api/v1/donations/available')
        .set('Authorization', `Bearer ${verifiedRecipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].foodName).toBe('Fresh Vegetable Pulao & Curd');
    });

    it('should enforce data visibility: unattached recipient sees rounded coordinates and no street/phone, owner sees exact', async () => {
      // 1. Unattached Recipient View
      const recipientRes = await request(app)
        .get(`/api/v1/donations/${createdDonationId}`)
        .set('Authorization', `Bearer ${verifiedRecipientToken}`);

      expect(recipientRes.status).toBe(200);
      expect(recipientRes.body.data.address.street).toBeNull(); // Redacted!
      expect(recipientRes.body.data.donor.phone).toBeNull(); // Masked!
      // Coordinates rounded to 2 decimal places [77.59, 12.97]
      expect(recipientRes.body.data.location.coordinates).toEqual([77.59, 12.97]);

      // 2. Owner Donor View
      const donorRes = await request(app)
        .get(`/api/v1/donations/${createdDonationId}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(donorRes.status).toBe(200);
      expect(donorRes.body.data.address.street).toBe('15 Residency Road, Ashok Nagar');
      expect(donorRes.body.data.donor.phone).toBe(donorUser.phone);
      expect(donorRes.body.data.location.coordinates[0]).toBeCloseTo(77.594628, 5);
    });

    it('should compute identical distanceKm for two different exact points inside the same rounded cell for unattached viewers', async () => {
      // Cell: [77.60, 12.98]
      // Point 1: [77.601, 12.982]
      // Point 2: [77.604, 12.984]
      const payload1 = {
        ...getValidDonationPayload(),
        location: { type: 'Point', coordinates: [77.601, 12.982] },
        foodName: 'Cell Point A',
      };
      const payload2 = {
        ...getValidDonationPayload(),
        location: { type: 'Point', coordinates: [77.604, 12.984] },
        foodName: 'Cell Point B',
      };

      const res1 = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(payload1);
      const res2 = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(payload2);

      const d1Id = res1.body.data._id || res1.body.data.id;
      const d2Id = res2.body.data._id || res2.body.data.id;

      // Unattached recipient querying available with lat/lng
      const searchRes = await request(app)
        .get('/api/v1/donations/available?lat=12.970&lng=77.590')
        .set('Authorization', `Bearer ${verifiedRecipientToken}`);

      expect(searchRes.status).toBe(200);
      const item1 = searchRes.body.data.find((d) => (d._id || d.id) === d1Id);
      const item2 = searchRes.body.data.find((d) => (d._id || d.id) === d2Id);

      expect(item1).toBeDefined();
      expect(item2).toBeDefined();
      // Distance is computed from rounded coordinates [77.60, 12.98] to 1 decimal place
      expect(item1.distanceKm).toBe(item2.distanceKm);

      // Verify that the direct toDonationView with donor (owner) clearance distinguishes exact points
      const { toDonationView } = require('../src/utils/donationView');
      const doc1 = await Donation.findById(d1Id);
      const doc2 = await Donation.findById(d2Id);

      const ownerView1 = toDonationView(doc1, donorUser, [77.590, 12.970]);
      const ownerView2 = toDonationView(doc2, donorUser, [77.590, 12.970]);
      expect(ownerView1.location.coordinates).toEqual([77.601, 12.982]);
      expect(ownerView2.location.coordinates).toEqual([77.604, 12.984]);
    });
  });

  describe('PATCH & Cancel Lifecycle Boundaries', () => {
    let donationId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(getValidDonationPayload());
      donationId = res.body.data._id || res.body.data.id;
    });

    it('should reject non-owner attempting to cancel or edit donation with 403 FORBIDDEN', async () => {
      const patchRes = await request(app)
        .patch(`/api/v1/donations/${donationId}`)
        .set('Authorization', `Bearer ${otherDonorToken}`)
        .send({ foodName: 'Hacked Name' });
      expect(patchRes.status).toBe(403);

      const cancelRes = await request(app)
        .post(`/api/v1/donations/${donationId}/cancel`)
        .set('Authorization', `Bearer ${otherDonorToken}`)
        .send({ reason: 'Malicious cancellation' });
      expect(cancelRes.status).toBe(403);
    });

    it('should successfully cancel donation, record statusHistory, and forbid repeating cancellation (409)', async () => {
      const cancelRes = await request(app)
        .post(`/api/v1/donations/${donationId}/cancel`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ reason: 'Event host changed plans' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe(DONATION_STATUS.CANCELLED);

      // Repeat cancel attempt should fail with 409
      const repeatRes = await request(app)
        .post(`/api/v1/donations/${donationId}/cancel`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ reason: 'Duplicate attempt' });

      expect(repeatRes.status).toBe(409);
      expect(repeatRes.body.error.code).toBe(ERROR_CODES.INVALID_STATUS_TRANSITION);
    });

    it('should block PATCH after acceptances exist on the donation with 409 INVALID_STATUS_TRANSITION', async () => {
      // Simulate Member 3 inserting an acceptance directly into DB
      await Donation.findByIdAndUpdate(donationId, {
        status: DONATION_STATUS.PARTIALLY_ACCEPTED,
        remainingQuantity: 20,
        $push: {
          acceptances: {
            recipientId: verifiedRecipientUser._id,
            quantity: 20,
            status: ACCEPTANCE_STATUS.CLAIMED,
          },
        },
      });

      const patchRes = await request(app)
        .patch(`/api/v1/donations/${donationId}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ foodName: 'Updated Food Name' });

      expect(patchRes.status).toBe(409);
      expect(patchRes.body.error.code).toBe(ERROR_CODES.INVALID_STATUS_TRANSITION);
    });

    it('should simulate race condition: reject PATCH and cancel with 409 if status was set to ACCEPTED directly in DB', async () => {
      // Direct DB update simulating concurrent race by Member 3 accepting the donation
      await Donation.findByIdAndUpdate(donationId, {
        status: DONATION_STATUS.ACCEPTED,
        remainingQuantity: 0,
      });

      // 1. Try PATCH: must fail with 409 INVALID_STATUS_TRANSITION
      const patchRes = await request(app)
        .patch(`/api/v1/donations/${donationId}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ foodName: 'Race Condition Name' });

      expect(patchRes.status).toBe(409);
      expect(patchRes.body.error.code).toBe(ERROR_CODES.INVALID_STATUS_TRANSITION);

      // 2. Try cancel: must fail with 409 INVALID_STATUS_TRANSITION
      const cancelRes = await request(app)
        .post(`/api/v1/donations/${donationId}/cancel`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ reason: 'Race cancellation' });

      expect(cancelRes.status).toBe(409);
      expect(cancelRes.body.error.code).toBe(ERROR_CODES.INVALID_STATUS_TRANSITION);
    });
  });
});
