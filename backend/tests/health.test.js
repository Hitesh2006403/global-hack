const request = require('supertest');
const app = require('../app');
const ERROR_CODES = require('../src/constants/errorCodes');

describe('System Health & Base Router Integration', () => {
  describe('GET /api/v1/health', () => {
    it('should return 200 OK with the standard success envelope and status, uptime, timestamp', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'System operational');
      expect(res.body).toHaveProperty('data');

      // Verify data object contains status, uptime, timestamp and nothing else
      const dataKeys = Object.keys(res.body.data).sort();
      expect(dataKeys).toEqual(['status', 'timestamp', 'uptime'].sort());

      expect(res.body.data.status).toBe('UP');
      expect(typeof res.body.data.uptime).toBe('number');
      expect(typeof res.body.data.timestamp).toBe('string');
      expect(new Date(res.body.data.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('GET /api/v1/meta', () => {
    it('should return 200 OK with all system enumerations without requiring authentication', async () => {
      const res = await request(app).get('/api/v1/meta');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');

      const { data } = res.body;

      // Roles
      expect(Array.isArray(data.roles)).toBe(true);
      expect(data.roles).toContain('donor');
      expect(data.roles).toContain('recipient');
      expect(data.roles).toContain('delivery_agent');
      expect(data.roles).toContain('admin');

      // Donation statuses
      expect(Array.isArray(data.donationStatuses)).toBe(true);
      expect(data.donationStatuses).toContain('AVAILABLE');
      expect(data.donationStatuses).toContain('COMPLETED');
      expect(data.donationStatuses).toContain('CANCELLED');
      expect(data.donationStatuses).toContain('EXPIRED');

      // Acceptance statuses
      expect(Array.isArray(data.acceptanceStatuses)).toBe(true);
      expect(data.acceptanceStatuses).toContain('CLAIMED');
      expect(data.acceptanceStatuses).toContain('COMPLETED');

      // Requirement statuses
      expect(Array.isArray(data.requirementStatuses)).toBe(true);
      expect(data.requirementStatuses).toContain('OPEN');
      expect(data.requirementStatuses).toContain('FULFILLED');

      // Food types, units, dietary types, urgency levels
      expect(Array.isArray(data.foodTypes)).toBe(true);
      expect(data.foodTypes).toContain('cooked_meals');
      expect(Array.isArray(data.units)).toBe(true);
      expect(data.units).toContain('plates');
      expect(Array.isArray(data.dietaryTypes)).toBe(true);
      expect(data.dietaryTypes).toContain('vegetarian');
      expect(Array.isArray(data.urgencyLevels)).toBe(true);
      expect(data.urgencyLevels).toContain('URGENT');
      expect(typeof data.defaultSafetyBufferMinutes).toBe('number');

      // Zero PII check
      const payloadStr = JSON.stringify(data);
      expect(payloadStr).not.toContain('email');
      expect(payloadStr).not.toContain('phone');
      expect(payloadStr).not.toContain('password');
    });
  });

  describe('Unknown Route Handler (404)', () => {
    it('should return 404 NOT_FOUND with the standard error envelope', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(res.body.error.message).toContain('Cannot GET /api/v1/nonexistent-route');
      expect(res.body.error.details).toBeNull();
    });
  });

  describe('Centralized errorHandler Middleware Unit Coverage', () => {
    const errorHandler = require('../src/middlewares/errorHandler');

    const createMockRes = () => {
      const res = {};
      res.statusCode = null;
      res.body = null;
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (body) => {
        res.body = body;
        return res;
      };
      return res;
    };

    it('should format Mongoose ValidationError properly', () => {
      const err = {
        name: 'ValidationError',
        errors: {
          field1: { message: 'field1 is invalid' },
        },
      };
      const res = createMockRes();
      errorHandler(err, {}, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.error.details).toEqual([{ field: 'field1', issue: 'field1 is invalid' }]);
    });

    it('should format MongoDB duplicate key error 11000 properly', () => {
      const err = {
        code: 11000,
        name: 'MongoServerError',
        keyPattern: { email: 1 },
      };
      const res = createMockRes();
      errorHandler(err, {}, res, () => {});

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe(ERROR_CODES.CONFLICT);
      expect(res.body.error.details).toEqual([{ field: 'email', issue: 'Value must be unique' }]);
    });

    it('should format JsonWebTokenError and TokenExpiredError properly', () => {
      const res1 = createMockRes();
      errorHandler({ name: 'JsonWebTokenError' }, {}, res1, () => {});
      expect(res1.statusCode).toBe(401);
      expect(res1.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);

      const res2 = createMockRes();
      errorHandler({ name: 'TokenExpiredError' }, {}, res2, () => {});
      expect(res2.statusCode).toBe(401);
      expect(res2.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should attach stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        const res = createMockRes();
        const err = new Error('Test Dev Error');
        err.stack = 'MockStack: at something';
        errorHandler(err, {}, res, () => {});

        expect(res.body.error.stack).toBe('MockStack: at something');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
