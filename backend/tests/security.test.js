const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const RecipientRequirement = require('../src/models/RecipientRequirement');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS, ACCEPTANCE_STATUS } = require('../src/constants/status');
const ERROR_CODES = require('../src/constants/errorCodes');
const authService = require('../src/services/authService');

describe('Security & Penetration Testing Suite (Attack-Style Verification)', () => {
  let adminUser, adminToken;
  let donorUserA, donorTokenA;
  let donorUserB, donorTokenB;
  let verifiedRecipient, recipientToken;
  let unverifiedRecipient, unverifiedRecipientToken;
  let deliveryAgent, deliveryAgentToken;
  let donationA;

  const validDonationPayload = {
    foodName: 'Fresh Tomato Pasta',
    foodType: 'cooked_meals',
    dietaryType: 'vegetarian',
    totalQuantity: 25,
    unit: 'plates',
    cookedAt: new Date(Date.now() - 3600000).toISOString(),
    expiryAt: new Date(Date.now() + 4 * 3600000).toISOString(),
    safetyBufferMinutes: 60,
    pickupWindowStart: new Date(Date.now() + 1800000).toISOString(),
    pickupWindowEnd: new Date(Date.now() + 2 * 3600000).toISOString(),
    location: {
      type: 'Point',
      coordinates: [77.591234, 12.971234],
    },
    address: {
      street: '42 Secret VIP Donor Lane',
      city: 'Bengaluru',
      formattedAddress: '42 Secret VIP Donor Lane, Bengaluru',
    },
  };

  beforeEach(async () => {
    // 1. Admin
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@shareaplate.org',
      password: 'Password123!',
      role: ROLES.ADMIN,
      phone: '+919999999999',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Admin HQ' },
    });
    adminToken = authService.generateToken(adminUser._id);

    // 2. Donor A
    donorUserA = await User.create({
      name: 'Donor Alpha',
      email: 'donor.a@restaurant.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919876543210',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.591234, 12.971234] },
      address: {
        street: '42 Secret VIP Donor Lane',
        city: 'Bengaluru',
        formattedAddress: '42 Secret VIP Donor Lane, Bengaluru',
      },
    });
    donorTokenA = authService.generateToken(donorUserA._id);

    // 3. Donor B
    donorUserB = await User.create({
      name: 'Donor Beta',
      email: 'donor.b@restaurant.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919876543222',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.6, 12.98] },
      address: { street: '10 Beta Road', city: 'Bengaluru', formattedAddress: 'Beta Kitchen' },
    });
    donorTokenB = authService.generateToken(donorUserB._id);

    // 4. Verified Recipient
    verifiedRecipient = await User.create({
      name: 'Shelter Hope',
      email: 'hope@shelter.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919876543333',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.61, 12.99] },
      address: { street: '5 Hope Street', city: 'Bengaluru', formattedAddress: 'Hope Center' },
    });
    recipientToken = authService.generateToken(verifiedRecipient._id);

    // 5. Unverified Recipient
    unverifiedRecipient = await User.create({
      name: 'Unverified Shelter',
      email: 'unverified@shelter.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919876543444',
      isVerified: false,
      isActive: true,
      location: { type: 'Point', coordinates: [77.62, 13.0] },
      address: { city: 'Bengaluru', formattedAddress: 'Unverified Center' },
    });
    unverifiedRecipientToken = authService.generateToken(unverifiedRecipient._id);

    // 6. Delivery Agent
    deliveryAgent = await User.create({
      name: 'Speedy Driver',
      email: 'speedy@delivery.org',
      password: 'Password123!',
      role: ROLES.DELIVERY_AGENT,
      phone: '+919876543555',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.63, 13.01] },
      address: { city: 'Bengaluru', formattedAddress: 'Driver Hub' },
    });
    deliveryAgentToken = authService.generateToken(deliveryAgent._id);

    // Seed Donation from Donor A
    const pastCooked = new Date(Date.now() - 3600000);
    const futureExpiry = new Date(Date.now() + 4 * 3600000);
    donationA = await Donation.create({
      donorId: donorUserA._id,
      foodName: 'Organic Tomato Pasta',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 25,
      remainingQuantity: 25,
      unit: 'plates',
      cookedAt: pastCooked,
      expiryAt: futureExpiry,
      safetyBufferMinutes: 60,
      pickupWindowStart: new Date(Date.now() + 1800000),
      pickupWindowEnd: new Date(Date.now() + 2 * 3600000),
      location: { type: 'Point', coordinates: [77.591234, 12.971234] },
      address: {
        street: '42 Secret VIP Donor Lane',
        city: 'Bengaluru',
        formattedAddress: '42 Secret VIP Donor Lane, Bengaluru',
      },
      status: DONATION_STATUS.AVAILABLE,
      acceptances: [],
      statusHistory: [
        {
          status: DONATION_STATUS.AVAILABLE,
          changedBy: donorUserA._id,
          note: 'Initial posting',
          timestamp: pastCooked,
        },
      ],
    });
  });

  // ============================================================================
  // ATTACK 1: Registration Tampering & NoSQL Injection
  // ============================================================================
  describe('Attack 1: Registration Tampering & NoSQL Injection', () => {
    it('should reject registration with role "admin"', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Hacker Admin',
          email: 'hacker.admin@evil.com',
          password: 'Password123!',
          role: 'admin',
          phone: '+919876543210',
          location: { type: 'Point', coordinates: [77.59, 12.97] },
          address: { city: 'Bengaluru', formattedAddress: 'HQ' },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject registration attempting mass-assignment of isVerified or isActive', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Sneaky Recipient',
          email: 'sneaky@shelter.org',
          password: 'Password123!',
          role: ROLES.RECIPIENT,
          phone: '+919876543210',
          isVerified: true,
          isActive: false,
          location: { type: 'Point', coordinates: [77.59, 12.97] },
          address: { city: 'Bengaluru', formattedAddress: 'HQ' },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject registration with extra nested or unrecognized fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Extra Fields',
          email: 'extra@domain.org',
          password: 'Password123!',
          role: ROLES.DONOR,
          phone: '+919876543210',
          location: { type: 'Point', coordinates: [77.59, 12.97] },
          address: { city: 'Bengaluru', formattedAddress: 'HQ' },
          malicious: { injectedField: 'exploit' },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject NoSQL operator object in register email and never crash', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'NoSQL Injector',
          email: { $gt: '' },
          password: 'Password123!',
          role: ROLES.DONOR,
          phone: '+919876543210',
          location: { type: 'Point', coordinates: [77.59, 12.97] },
          address: { city: 'Bengaluru', formattedAddress: 'HQ' },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject NoSQL operator object in login email and login password', async () => {
      // 1. Email injection
      const res1 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: { $gt: '' },
          password: 'Password123!',
        });
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);
      expect(res1.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);

      // 2. Password injection
      const res2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'donor.a@restaurant.org',
          password: { $ne: 'wrong' },
        });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  // ============================================================================
  // ATTACK 2: Malformed JSON, Oversized Body, Wrong Content-Type
  // ============================================================================
  describe('Attack 2: Malformed JSON, Oversized Payloads, Wrong Content-Type', () => {
    it('should reject malformed JSON with 400 and clean JSON error envelope (never HTML or 500)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "broken-json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.headers['content-type']).toMatch(/json/);
    });

    it('should reject oversized body (>10kb) with 413 PAYLOAD_TOO_LARGE JSON envelope', async () => {
      const hugeString = 'A'.repeat(15 * 1024); // 15 KB
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'test@domain.org', password: hugeString }));

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.PAYLOAD_TOO_LARGE);
      expect(res.headers['content-type']).toMatch(/json/);
    });

    it('should handle wrong content-type (text/plain) safely with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'text/plain')
        .send('just plain text');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  // ============================================================================
  // ATTACK 3: Token Attacks
  // ============================================================================
  describe('Attack 3: Token Attacks & Cryptographic Verification', () => {
    it('should reject token signed with a different secret with 401 UNAUTHORIZED', async () => {
      const foreignSecret = 'this-is-a-completely-different-32-byte-secret-key!';
      const forgedToken = jwt.sign({ id: donorUserA._id.toString() }, foreignSecret, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should reject token with algorithm "none" with 401 UNAUTHORIZED', async () => {
      const unsignedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const unsignedPayload = Buffer.from(JSON.stringify({ id: donorUserA._id.toString() })).toString('base64url');
      const noneToken = `${unsignedHeader}.${unsignedPayload}.`;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${noneToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should reject token for a deleted user with 401 UNAUTHORIZED', async () => {
      const tempUser = await User.create({
        name: 'Ephemeral User',
        email: 'ephemeral@delete.org',
        password: 'Password123!',
        role: ROLES.DONOR,
        phone: '+919999900000',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        address: { city: 'Bengaluru', formattedAddress: 'Temp' },
      });
      const tempToken = authService.generateToken(tempUser._id);

      // Delete user from DB
      await User.findByIdAndDelete(tempUser._id);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tempToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should reject token for a deactivated user immediately with 403 DEACTIVATED_ACCOUNT', async () => {
      donorUserA.isActive = false;
      await donorUserA.save();

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${donorTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.DEACTIVATED_ACCOUNT);
    });

    it('should reject an expired token with 401 UNAUTHORIZED', async () => {
      const expiredToken = jwt.sign(
        { id: donorUserA._id.toString() },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });
  });

  // ============================================================================
  // ATTACK 4: Table-Driven Privilege Escalation Matrix
  // ============================================================================
  describe('Attack 4: Table-Driven Privilege Escalation Matrix', () => {
    const forbiddenCases = [
      // Format: [method, path, userRole, tokenGetter, expectedStatus]
      { method: 'post', path: '/api/v1/donations', caller: 'Unauthenticated', token: null, status: 401 },
      { method: 'post', path: '/api/v1/donations', caller: 'Recipient', token: () => recipientToken, status: 403 },
      { method: 'post', path: '/api/v1/donations', caller: 'Delivery Agent', token: () => deliveryAgentToken, status: 403 },

      { method: 'get', path: '/api/v1/donations/my', caller: 'Unauthenticated', token: null, status: 401 },
      { method: 'get', path: '/api/v1/donations/my', caller: 'Recipient', token: () => recipientToken, status: 403 },
      { method: 'get', path: '/api/v1/donations/my', caller: 'Delivery Agent', token: () => deliveryAgentToken, status: 403 },

      { method: 'get', path: '/api/v1/donations/available', caller: 'Unauthenticated', token: null, status: 401 },
      { method: 'get', path: '/api/v1/donations/available', caller: 'Donor', token: () => donorTokenA, status: 403 },
      { method: 'get', path: '/api/v1/donations/available', caller: 'Unverified Recipient', token: () => unverifiedRecipientToken, status: 403 },

      { method: 'post', path: '/api/v1/requirements', caller: 'Unauthenticated', token: null, status: 401 },
      { method: 'post', path: '/api/v1/requirements', caller: 'Donor', token: () => donorTokenA, status: 403 },
      { method: 'post', path: '/api/v1/requirements', caller: 'Delivery Agent', token: () => deliveryAgentToken, status: 403 },
      { method: 'post', path: '/api/v1/requirements', caller: 'Unverified Recipient', token: () => unverifiedRecipientToken, status: 403 },

      { method: 'get', path: '/api/v1/dashboard/donor', caller: 'Unauthenticated', token: null, status: 401 },
      { method: 'get', path: '/api/v1/dashboard/donor', caller: 'Recipient', token: () => recipientToken, status: 403 },
      { method: 'get', path: '/api/v1/dashboard/donor', caller: 'Delivery Agent', token: () => deliveryAgentToken, status: 403 },

      { method: 'get', path: '/api/v1/dashboard/recipient', caller: 'Unauthenticated', token: null, status: 401 },
      { method: 'get', path: '/api/v1/dashboard/recipient', caller: 'Donor', token: () => donorTokenA, status: 403 },
      { method: 'get', path: '/api/v1/dashboard/recipient', caller: 'Delivery Agent', token: () => deliveryAgentToken, status: 403 },
      { method: 'get', path: '/api/v1/dashboard/recipient', caller: 'Unverified Recipient', token: () => unverifiedRecipientToken, status: 403 },

      { method: 'get', path: '/api/v1/admin/users', caller: 'Unauthenticated', token: null, status: 401 },
      { method: 'get', path: '/api/v1/admin/users', caller: 'Donor', token: () => donorTokenA, status: 403 },
      { method: 'get', path: '/api/v1/admin/users', caller: 'Recipient', token: () => recipientToken, status: 403 },
      { method: 'get', path: '/api/v1/admin/users', caller: 'Delivery Agent', token: () => deliveryAgentToken, status: 403 },

      { method: 'get', path: '/api/v1/admin/donations', caller: 'Unauthenticated', token: null, status: 401 },
      { method: 'get', path: '/api/v1/admin/donations', caller: 'Donor', token: () => donorTokenA, status: 403 },
      { method: 'get', path: '/api/v1/admin/donations', caller: 'Recipient', token: () => recipientToken, status: 403 },
      { method: 'get', path: '/api/v1/admin/donations', caller: 'Delivery Agent', token: () => deliveryAgentToken, status: 403 },
    ];

    test.each(forbiddenCases)(
      'should deny $caller calling $method.toUpperCase() $path with HTTP $status',
      async ({ method, path, token, status }) => {
        const reqBuilder = request(app)[method](path);
        if (token) {
          reqBuilder.set('Authorization', `Bearer ${token()}`);
        }
        const res = await reqBuilder;
        expect(res.status).toBe(status);
        expect(res.body.success).toBe(false);
      }
    );
  });

  // ============================================================================
  // ATTACK 5: Insecure Direct Object References (IDOR)
  // ============================================================================
  describe('Attack 5: Insecure Direct Object Reference (IDOR) Protection', () => {
    it('should block Donor B from modifying Donor A donation with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch(`/api/v1/donations/${donationA._id}`)
        .set('Authorization', `Bearer ${donorTokenB}`)
        .send({ instructions: 'Malicious modification by Donor B' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should block Donor B from cancelling Donor A donation with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post(`/api/v1/donations/${donationA._id}/cancel`)
        .set('Authorization', `Bearer ${donorTokenB}`)
        .send({ reason: 'Malicious cancellation by Donor B' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should block unattached Recipient from viewing status-history of Donor A donation with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`/api/v1/donations/${donationA._id}/status-history`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should isolate recipient dashboard so Recipient A only sees their own data', async () => {
      // Create requirement for verified recipient
      await RecipientRequirement.create({
        recipientId: verifiedRecipient._id,
        title: 'Shelter Hope Needs Bread',
        foodType: 'bakery_items',
        quantityNeeded: 30,
        unit: 'packets',
        neededBy: new Date(Date.now() + 5 * 3600000),
        urgency: 'HIGH',
        location: { type: 'Point', coordinates: [77.61, 12.99] },
        address: { city: 'Bengaluru', formattedAddress: 'Hope Center' },
      });

      // Create a second recipient
      const recipient2 = await User.create({
        name: 'Second Shelter',
        email: 'second@shelter.org',
        password: 'Password123!',
        role: ROLES.RECIPIENT,
        phone: '+919876543999',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.6, 12.98] },
        address: { city: 'Bengaluru', formattedAddress: 'Second Shelter' },
      });
      const token2 = authService.generateToken(recipient2._id);

      const res = await request(app)
        .get('/api/v1/dashboard/recipient')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.data.countsPerStatus.OPEN).toBe(0);
      expect(res.body.data.last5Acceptances).toHaveLength(0);
    });
  });

  // ============================================================================
  // ATTACK 6: Invalid ObjectIds
  // ============================================================================
  describe('Attack 6: Invalid ObjectIds (Format Fuzzing on /:id Routes)', () => {
    const invalidIdRoutes = [
      { method: 'get', path: '/api/v1/donations/invalid-id-abc' },
      { method: 'patch', path: '/api/v1/donations/invalid-id-abc', body: { instructions: 'test' } },
      { method: 'post', path: '/api/v1/donations/invalid-id-abc/cancel', body: { reason: 'test' } },
      { method: 'get', path: '/api/v1/donations/invalid-id-abc/status-history' },
      { method: 'get', path: '/api/v1/requirements/invalid-id-abc' },
      { method: 'patch', path: '/api/v1/admin/users/invalid-id-abc/verify' },
      { method: 'patch', path: '/api/v1/admin/users/invalid-id-abc/deactivate' },
    ];

    test.each(invalidIdRoutes)(
      'should handle $method.toUpperCase() $path with 400 INVALID_ID (never 500)',
      async ({ method, path, body }) => {
        const reqBuilder = request(app)[method](path).set('Authorization', `Bearer ${adminToken}`);
        if (body) {
          reqBuilder.send(body);
        }
        const res = await reqBuilder;
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe(ERROR_CODES.INVALID_ID);
        expect(res.body.error.message).toMatch(/Invalid identifier format/);
      }
    );
  });

  // ============================================================================
  // ATTACK 7: Query Abuse (Pagination Clamping & NoSQL Filter Injection)
  // ============================================================================
  describe('Attack 7: Query Abuse & Boundary Enforcement', () => {
    it('should clamp extreme limit=100000 to safe maximum and negative page=-1 to 1', async () => {
      const res = await request(app)
        .get('/api/v1/donations/available?page=-1&limit=100000')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(50); // Clamped to 50
    });

    it('should clamp non-numeric limit="abc" to default limit 10', async () => {
      const res = await request(app)
        .get('/api/v1/donations/available?limit=abc')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(10);
    });

    it('should reject out-of-range latitude/longitude with 400 VALIDATION_ERROR (preventing Mongo 500)', async () => {
      const res = await request(app)
        .get('/api/v1/donations/available?lat=999&lng=999')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject negative maxDistanceKm with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/v1/donations/available?lat=12.97&lng=77.59&maxDistanceKm=-10')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject query parameter containing MongoDB $ operator keys with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/v1/donations?foodType[$ne]=cooked_meals')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject invalid date format in admin donations query with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/v1/admin/donations?dateFrom=not-a-valid-date')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  // ============================================================================
  // ATTACK 8: Privacy & PII Leak Audits
  // ============================================================================
  describe('Attack 8: Privacy & Data Leak Audits Across Endpoints', () => {
    it('should verify unattached recipient sees rounded coordinates, street null, and no donor phone', async () => {
      const res = await request(app)
        .get(`/api/v1/donations/${donationA._id}`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Coordinates rounded to 2 decimals
      expect(data.location.coordinates[0]).toBe(77.59);
      expect(data.location.coordinates[1]).toBe(12.97);

      // PII street address redacted
      expect(data.address.street).toBeNull();

      // Donor phone redacted
      expect(data.donor.phone).toBeNull();

      // Raw string inspection
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toContain('42 Secret VIP Donor Lane');
      expect(rawBody).not.toContain('+919876543210');
      expect(rawBody).not.toContain('password');
      expect(rawBody).not.toContain('$2a$');
      expect(rawBody).not.toContain('$2b$');
    });

    it('should verify requirements list redacts exact street for non-owners', async () => {
      await RecipientRequirement.create({
        recipientId: verifiedRecipient._id,
        title: 'Confidential Shelter Need',
        foodType: 'cooked_meals',
        quantityNeeded: 20,
        unit: 'plates',
        neededBy: new Date(Date.now() + 3600000),
        urgency: 'HIGH',
        location: { type: 'Point', coordinates: [77.591234, 12.971234] },
        address: { street: '99 Secret Shelter Way', city: 'Bengaluru', formattedAddress: 'Shelter' },
      });

      const res = await request(app)
        .get('/api/v1/requirements')
        .set('Authorization', `Bearer ${donorTokenA}`);

      expect(res.status).toBe(200);
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toContain('99 Secret Shelter Way');
    });

    it('should verify no endpoint leaks JWT_SECRET, Mongo URI, or bcrypt hashes in body', async () => {
      const endpoints = [
        { path: `/api/v1/donations/${donationA._id}`, token: recipientToken },
        { path: '/api/v1/donations/available', token: recipientToken },
        { path: '/api/v1/dashboard/donor', token: donorTokenA },
        { path: '/api/v1/dashboard/recipient', token: recipientToken },
        { path: '/api/v1/admin/donations', token: adminToken },
        { path: '/api/v1/admin/users', token: adminToken },
      ];

      for (const { path, token } of endpoints) {
        const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        const jsonStr = JSON.stringify(res.body);
        expect(jsonStr).not.toContain(process.env.JWT_SECRET);
        expect(jsonStr).not.toContain('$2a$');
        expect(jsonStr).not.toContain('$2b$');
        expect(jsonStr).not.toContain('mongodb');
      }
    });
  });

  // ============================================================================
  // ATTACK 9: Public Dashboard Privacy
  // ============================================================================
  describe('Attack 9: Public /dashboard/impact Privacy Assurance', () => {
    it('should confirm public impact dashboard contains ZERO personal data', async () => {
      const res = await request(app).get('/api/v1/dashboard/impact');

      expect(res.status).toBe(200);
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toContain('donor');
      expect(rawBody).not.toContain('recipient');
      expect(rawBody).not.toContain('@');
      expect(rawBody).not.toContain('+91');
      expect(rawBody).not.toContain('Street');
      expect(rawBody).not.toContain('Road');
      expect(rawBody).not.toContain('password');

      // Only aggregate numbers exist
      expect(Object.keys(res.body.data)).toEqual([
        'mealsSaved',
        'percentCompletedBeforeExpiry',
        'avgTimeToMatchMinutes',
        'totalDonationsPosted',
        'totalDonationsCompleted',
        'activeDonationsCount',
        'registeredDonorsCount',
        'registeredRecipientsCount',
      ]);
    });
  });

  // ============================================================================
  // ATTACK 10: Stack Trace Suppression in Production
  // ============================================================================
  describe('Attack 10: Error Trace Leak Mitigation in Production Configuration', () => {
    it('should NEVER include stack trace, file paths, or Mongo URI in error response', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        const res = await request(app)
          .get('/api/v1/donations/invalid-cast-id')
          .set('Authorization', `Bearer ${donorTokenA}`);

        expect(res.status).toBe(400);
        expect(res.body.error.stack).toBeUndefined();

        const jsonStr = JSON.stringify(res.body);
        expect(jsonStr).not.toContain('.js:');
        expect(jsonStr).not.toContain('mongodb');
        expect(jsonStr).not.toContain('node_modules');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  // ============================================================================
  // ATTACK 11: CORS Origin Whitelisting
  // ============================================================================
  describe('Attack 11: CORS Domain Isolation', () => {
    it('should set Access-Control-Allow-Origin only for whitelisted CLIENT_URL', async () => {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

      const allowedRes = await request(app)
        .get('/api/v1/health')
        .set('Origin', clientUrl);

      expect(allowedRes.headers['access-control-allow-origin']).toBe(clientUrl);
    });

    it('should NOT set Access-Control-Allow-Origin header for unauthorized foreign origins', async () => {
      const disallowedRes = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://malicious-phishing-site.com');

      expect(disallowedRes.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  // ============================================================================
  // ATTACK 12: Helmet Security Headers
  // ============================================================================
  describe('Attack 12: Helmet Security Headers Verification', () => {
    it('should include required Helmet defense headers on all responses', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-download-options']).toBe('noopen');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
    });
  });
});
