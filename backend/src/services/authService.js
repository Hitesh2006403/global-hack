const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Fail fast at startup: Ensure JWT_SECRET is configured and cryptographically sufficient
const validateJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      '[FATAL SECURITY CONFIGURATION] JWT_SECRET must be defined in the environment and be at least 32 characters long.'
    );
  }
  return secret.trim();
};

// Validate immediately on module load
const JWT_SECRET = validateJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Pre-computed dummy hash to mitigate user enumeration timing attacks on unknown emails
const DUMMY_HASH = bcrypt.hashSync('dummy_timing_defense_seed_password', 10);

/**
 * Signs a JWT containing ONLY the user ID.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User identifier
 * @returns {string} Signed JWT Bearer token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId.toString() }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verifies and decodes a JWT Bearer token.
 * SECURITY: Pins algorithms to HS256 to prevent algorithm confusion attacks.
 *
 * @param {string} token - Raw JWT string
 * @returns {Object} Decoded payload ({ id, iat, exp })
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
  });
};

/**
 * Hashes a plaintext password using bcryptjs.
 *
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Hashed password string
 */
const hashPassword = async (password) => {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;
  return bcrypt.hash(password, saltRounds);
};

/**
 * Compares plaintext password against a bcrypt hash.
 *
 * @param {string} candidatePassword - Plaintext password
 * @param {string} hashedPassword - Stored hash
 * @returns {Promise<boolean>}
 */
const comparePassword = async (candidatePassword, hashedPassword) => {
  return bcrypt.compare(candidatePassword, hashedPassword);
};

/**
 * Performs a dummy bcrypt comparison to equalize response timing when an email does not exist.
 *
 * @param {string} password - Candidate plaintext password
 * @returns {Promise<boolean>} Always resolves to false
 */
const dummyCompare = async (password) => {
  await bcrypt.compare(password, DUMMY_HASH);
  return false;
};

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  dummyCompare,
  validateJwtSecret,
};
