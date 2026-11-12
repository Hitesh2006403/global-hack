const User = require('../models/User');
const authService = require('../services/authService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Register a new user (donor, recipient, or delivery agent).
 * Admin registration via this endpoint is strictly rejected.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, location, address, organization } = req.body;

  // Check for duplicate email
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'An account with this email address already exists');
  }

  // Create user record
  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    location,
    address,
    organization,
  });

  // Generate JWT containing ONLY user ID
  const token = authService.generateToken(user._id);

  return ApiResponse.send(res, 201, 'User registered successfully', {
    user,
    token,
  });
});

/**
 * Authenticate user with email and password.
 * TIMING ATTACK MITIGATION: Runs dummy bcrypt comparison on non-existent emails and
 * returns identical generic error message for both invalid email and invalid password.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +isActive');

  if (!user) {
    // Perform dummy bcrypt comparison to equalize execution time
    await authService.dummyCompare(password);
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid email or password');
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      ERROR_CODES.DEACTIVATED_ACCOUNT,
      'This account has been deactivated. Access is denied.'
    );
  }

  const token = authService.generateToken(user._id);

  return ApiResponse.send(res, 200, 'Login successful', {
    user,
    token,
  });
});

/**
 * Client-side logout acknowledgment.
 */
const logout = asyncHandler(async (req, res) => {
  return ApiResponse.send(res, 200, 'Logged out successfully');
});

/**
 * Retrieve authenticated user's current profile.
 */
const getMe = asyncHandler(async (req, res) => {
  return ApiResponse.send(res, 200, 'Current user profile retrieved', {
    user: req.user,
  });
});

const crypto = require('crypto');
const { googleClient, getGoogleClientId } = require('../config/google');
const { ROLES } = require('../constants/roles');

/**
 * Authenticate or register user via verified Google ID token.
 */
const googleAuth = asyncHandler(async (req, res) => {
  const { credential, role: rawRole = 'donor', portalVerificationData = {} } = req.body;

  if (!credential) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Google ID token credential is required');
  }

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new ApiError(
      500,
      ERROR_CODES.INTERNAL_ERROR,
      'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID in backend/.env.'
    );
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch (verifyError) {
    console.error('Google token verification failed:', verifyError.message);
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid or expired Google authentication credential');
  }

  if (!payload || !payload.sub || !payload.email) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Failed to extract verified identity from Google token');
  }

  const googleId = payload.sub;
  const email = payload.email.toLowerCase();
  const name = payload.name || email.split('@')[0];
  const picture = payload.picture || '';

  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'ops@shareaplate.org,admin@shareaplate.org')
    .toLowerCase()
    .split(',')
    .map((e) => e.trim());

  let role = rawRole === 'delivery' ? ROLES.DELIVERY_AGENT : rawRole;
  if (!Object.values(ROLES).includes(role)) {
    role = ROLES.DONOR;
  }

  // Security rule: Platform Admin cannot be claimed unless pre-authorized
  if (role === ROLES.ADMIN) {
    const isPreApprovedAdmin = ADMIN_EMAILS.includes(email);
    const existingAdmin = await User.findOne({ email });
    if (!isPreApprovedAdmin && (!existingAdmin || existingAdmin.role !== ROLES.ADMIN)) {
      throw new ApiError(
        403,
        ERROR_CODES.FORBIDDEN,
        'Access denied: Public Google Sign-In cannot be used to create administrator access. Platform Admin requires pre-authorized clearance.'
      );
    }
  }

  let user = await User.findOne({ googleId });
  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      user.googleId = googleId;
      user.googleVerified = true;
      user.authProvider = 'google';
      if (picture && !user.avatar) user.avatar = picture;
      await user.save();
    } else {
      const generatedPassword = crypto.randomBytes(24).toString('hex');
      const orgName = portalVerificationData.organizationName || `${name}'s Organization`;
      user = await User.create({
        name,
        email,
        password: generatedPassword,
        role,
        phone: portalVerificationData.phone || '+91-9876543210',
        isVerified: role === ROLES.DONOR || role === ROLES.ADMIN,
        isActive: true,
        googleId,
        googleVerified: true,
        authProvider: 'google',
        avatar: picture,
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716],
        },
        address: {
          street: 'Operations Hub',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          formattedAddress: 'Bengaluru Operations Hub, MG Road, Bengaluru, KA 560001',
        },
        organization: {
          name: orgName,
          regNo: portalVerificationData.ngoRegId || portalVerificationData.fssaiNumber || 'REG-PENDING',
        },
      });
    }
  } else {
    if (picture) user.avatar = picture;
    user.googleVerified = true;
    await user.save();
  }

  const token = authService.generateToken(user._id);

  return ApiResponse.send(res, 200, `Authenticated as ${user.name} (${user.role})`, {
    user,
    token,
  });
});

module.exports = {
  register,
  login,
  googleAuth,
  logout,
  getMe,
};
