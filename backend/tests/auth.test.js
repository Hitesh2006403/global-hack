const request = require('supertest');
const app = require('../app');
const User = require('../src/models/User');
const { ROLES } = require('../src/constants/roles');
const ERROR_CODES = require('../src/constants/errorCodes');
const authService = require('../src/services/authService');
describe('Authentication & Session Management (/api/v1/auth)', () => {
  const validUserPayload = {
    name: 'Sunshine Orphanage',
    email: 'contact@sunshine.org',
    password: 'Password123!',
    role: 'recipient',
    phone: '+919876543210',
    location: {
      type: 'Point',
      coordinates: [77.5946, 12.9716],
    },
    address: {
      street: '12 Bannerghatta Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560076',
      formattedAddress: '12 Bannerghatta Road, Bengaluru, Karnataka 560076',
    },
    organization: {
      name: 'Sunshine Trust',
      regNo: 'REG-BLR-2024-998',
      capacity: 85,
    },
  };

  describe('POST /api/v1/auth/register', () => {
    it('should register successfully, return 201 with JWT token, and omit password from user data', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validUserPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(validUserPayload.email);
      expect(res.body.data.user.role).toBe(ROLES.RECIPIENT);
      expect(res.body.data.user.isVerified).toBe(false); // Recipient defaults to unverified
      expect(res.body.data.user.isActive).toBe(true);
      expect(res.body.data.user.password).toBeUndefined(); // Never expose password
    });

    it('should reject duplicate email with 409 CONFLICT', async () => {
      await request(app).post('/api/v1/auth/register').send(validUserPayload);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validUserPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.CONFLICT);
      expect(res.body.error.message).toContain('already exists');
    });

    it('should reject registration with role "admin" with 400 VALIDATION_ERROR', async () => {
      const adminPayload = {
        ...validUserPayload,
        email: 'attacker@evil.com',
        role: 'admin',
      };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(adminPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject unknown extra fields with 400 VALIDATION_ERROR (strict schema mass-assignment guard)', async () => {
      const massAssignmentPayload = {
        ...validUserPayload,
        email: 'massassign@test.com',
        isVerified: true, // Forbidden field
        isActive: false,  // Forbidden field
      };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(massAssignmentPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject weak password without numbers or letters with 400 VALIDATION_ERROR', async () => {
      const weakPasswordPayload = {
        ...validUserPayload,
        email: 'weakpass@test.com',
        password: 'onlyletters', // No number, fails regex
      };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(weakPasswordPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(validUserPayload);
    });

    it('should login successfully with valid credentials and return 200 with token', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: validUserPayload.email,
        password: validUserPayload.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.email).toBe(validUserPayload.email);
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should return identical 401 error response for wrong password and unknown email (timing defense)', async () => {
      const wrongPasswordRes = await request(app).post('/api/v1/auth/login').send({
        email: validUserPayload.email,
        password: 'WrongPassword999!',
      });

      const unknownEmailRes = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@nowhere.org',
        password: 'Password123!',
      });

      expect(wrongPasswordRes.status).toBe(401);
      expect(unknownEmailRes.status).toBe(401);

      expect(wrongPasswordRes.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(unknownEmailRes.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);

      // Verify exact identical error message to prevent user enumeration
      expect(wrongPasswordRes.body.error.message).toBe('Invalid email or password');
      expect(unknownEmailRes.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('Protected Route & Session Verification', () => {
    let validToken;
    let userId;

    beforeEach(async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(validUserPayload);
      validToken = reg.body.data.token;
      userId = reg.body.data.user._id;
    });

    it('should return 401 when accessing protected route without a Bearer token', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should return 401 when token is tampered with or malformed', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer tampered.invalid.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should return 200 with current user profile when valid token is provided', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validUserPayload.email);
    });

    it('should reject request with 403 immediately if user account is deactivated in database', async () => {
      // Deactivate user directly in DB
      await User.findByIdAndUpdate(userId, { isActive: false });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.DEACTIVATED_ACCOUNT);
    });

    it('should block unverified recipient from calling requireVerified action with 403 UNVERIFIED_ACCOUNT', async () => {
      // User is an unverified recipient
      const res = await request(app)
        .get('/api/v1/test-verified-action')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNVERIFIED_ACCOUNT);
    });

    it('should allow access to requireVerified action once user is verified', async () => {
      // Verify user in DB
      await User.findByIdAndUpdate(userId, { isVerified: true });

      const res = await request(app)
        .get('/api/v1/test-verified-action')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject an expired token with 401 UNAUTHORIZED', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { id: userId.toString() },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should prevent deactivated user from logging in at /auth/login with 403 DEACTIVATED_ACCOUNT', async () => {
      // Deactivate user in DB
      await User.findByIdAndUpdate(userId, { isActive: false });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: validUserPayload.email,
        password: validUserPayload.password,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.DEACTIVATED_ACCOUNT);
    });

    it('should judge user permissions by current DB role rather than any token claims', async () => {
      // Initially, user is recipient. Change role in DB to donor.
      await User.findByIdAndUpdate(userId, { role: ROLES.DONOR });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(ROLES.DONOR);
    });

    it('should acknowledge logout with 200 OK', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out');
    });
  });
});
