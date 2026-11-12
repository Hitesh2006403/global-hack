const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { registerSchema, loginSchema } = require('../validations/authValidation');
const validate = require('../middlewares/validateMiddleware');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Rate limiter for authentication endpoints (relaxed in test environment)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 20, // 20 attempts per 15 minutes in non-test
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      details: null,
    },
  },
  skip: () => process.env.NODE_ENV === 'test',
});

// Public authentication routes
router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/google', authLimiter, authController.googleAuth);

// Protected authentication routes
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);

module.exports = router;
