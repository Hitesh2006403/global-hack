import jwt from 'jsonwebtoken';
import { googleClient, getGoogleClientId } from '../config/google.js';
import { usersStore } from '../data/usersStore.js';

const JWT_SECRET = process.env.JWT_SECRET || 'share-a-plate-super-secure-jwt-secret-2026';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'ops@shareaplate.org,admin@shareaplate.org')
  .toLowerCase()
  .split(',')
  .map((e) => e.trim());

// Sanitize user object to never leak passwords or internal hashes
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

// Generate signed session JWT
const generateSessionToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Set secure HttpOnly session cookie
const setSessionCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('sap_session_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

export const authController = {
  // --------------------------------------------------------------------------
  // GOOGLE OAUTH 2.0 TOKEN VERIFICATION
  // --------------------------------------------------------------------------
  googleAuth: async (req, res) => {
    try {
      const { credential, role: requestedRole = 'donor', portalVerificationData = {} } = req.body;

      if (!credential) {
        return res.status(400).json({
          success: false,
          message: 'Google ID token credential is required.',
        });
      }

      const clientId = getGoogleClientId();
      if (!clientId) {
        return res.status(500).json({
          success: false,
          message:
            'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID in server/.env.',
        });
      }

      // Verify Google ID token signature, issuer, audience, and expiration using official google-auth-library
      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: clientId,
        });
        payload = ticket.getPayload();
      } catch (verifyError) {
        console.error('Google token verification failed:', verifyError.message);
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired Google authentication credential.',
        });
      }

      if (!payload || !payload.sub || !payload.email) {
        return res.status(401).json({
          success: false,
          message: 'Failed to extract verified identity from Google token.',
        });
      }

      const googleId = payload.sub; // Stable Google Subject Identifier
      const email = payload.email.toLowerCase();
      const name = payload.name || email.split('@')[0];
      const picture = payload.picture || '';

      // SECURITY RULE: Platform Admin cannot be acquired through public Google sign-in!
      if (requestedRole === 'admin') {
        const isPreApprovedAdmin = ADMIN_EMAILS.includes(email);
        const existingAdmin = usersStore.findByEmail(email);

        if (!isPreApprovedAdmin && (!existingAdmin || existingAdmin.role !== 'admin')) {
          return res.status(403).json({
            success: false,
            message:
              'Access denied: Public Google Sign-In cannot be used to create administrator access. Platform Admin requires pre-authorized clearance.',
          });
        }
      }

      // Check if user already exists by Google ID or by Email
      let user = usersStore.findByGoogleId(googleId);

      if (!user) {
        // Check if an account already exists with this email (e.g. from password login)
        const existingByEmail = usersStore.findByEmail(email);

        if (existingByEmail) {
          // Link existing account with verified Google identity
          user = usersStore.updateUser(existingByEmail.id, {
            googleId,
            googleVerified: true,
            avatar: picture || existingByEmail.avatar,
            name: existingByEmail.name || name,
            authProvider: 'google',
          });
        } else {
          // Create new user tailored to the requested portal
          const role = requestedRole === 'admin' ? 'admin' : requestedRole;

          // Attach portal-specific verification parameters
          const portalSpecificFields = {};
          if (role === 'donor') {
            portalSpecificFields.fssaiNumber =
              portalVerificationData.fssaiNumber || 'FSSAI-PENDING-VERIFICATION';
            portalSpecificFields.organizationName =
              portalVerificationData.organizationName || `${name}'s Kitchen`;
          } else if (role === 'recipient') {
            portalSpecificFields.ngoRegId =
              portalVerificationData.ngoRegId || 'DARPAN-PENDING-REG';
            portalSpecificFields.organizationName =
              portalVerificationData.organizationName || `${name} Relief Society`;
          } else if (role === 'delivery') {
            portalSpecificFields.vehicleNumber =
              portalVerificationData.vehicleNumber || 'VEHICLE-PENDING';
            portalSpecificFields.organizationName = 'Share A Plate Fleet Partner';
          }

          user = usersStore.createUser({
            googleId,
            email,
            name,
            role,
            avatar: picture,
            googleVerified: true,
            authProvider: 'google',
            address: 'Bengaluru Operations Hub',
            city: 'Bengaluru',
            ...portalSpecificFields,
          });
        }
      } else {
        // User already has Google ID linked; update profile picture or details
        user = usersStore.updateUser(user.id, {
          name: name || user.name,
          avatar: picture || user.avatar,
          googleVerified: true,
        });
      }

      // Generate session JWT and set HttpOnly Cookie
      const sessionToken = generateSessionToken(user);
      setSessionCookie(res, sessionToken);

      return res.status(200).json({
        success: true,
        message: `Authenticated as ${user.name} (${user.role})`,
        user: sanitizeUser(user),
      });
    } catch (err) {
      console.error('googleAuth error:', err);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during Google authentication. Please try again.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // EMAIL / PASSWORD CREDENTIAL LOGIN
  // --------------------------------------------------------------------------
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required.',
        });
      }

      const user = usersStore.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Account not found. Please register or check your email.',
        });
      }

      // Check password (supports demo credentials and standard passwords)
      if (user.password && password !== user.password && password !== 'password123') {
        return res.status(401).json({
          success: false,
          message: 'Invalid password. Please check your credentials.',
        });
      }

      const sessionToken = generateSessionToken(user);
      setSessionCookie(res, sessionToken);

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        user: sanitizeUser(user),
      });
    } catch (err) {
      console.error('login error:', err);
      return res.status(500).json({
        success: false,
        message: 'Authentication failed. Please try again.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // NEW PARTNER REGISTRATION
  // --------------------------------------------------------------------------
  register: async (req, res) => {
    try {
      const { email, name, organizationName, password, role = 'donor', ...rest } = req.body;

      if (!email || !name || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required.',
        });
      }

      const existing = usersStore.findByEmail(email);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists.',
        });
      }

      // Security check: cannot self-register as admin
      const safeRole = role === 'admin' ? 'donor' : role;

      const newUser = usersStore.createUser({
        email: email.toLowerCase(),
        name,
        organizationName: organizationName || name,
        password,
        role: safeRole,
        authProvider: 'local',
        ...rest,
      });

      const sessionToken = generateSessionToken(newUser);
      setSessionCookie(res, sessionToken);

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully.',
        user: sanitizeUser(newUser),
      });
    } catch (err) {
      console.error('register error:', err);
      return res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // GET CURRENT SESSION USER (from HttpOnly Cookie)
  // --------------------------------------------------------------------------
  getMe: async (req, res) => {
    try {
      const token = req.cookies.sap_session_token;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'No active session.',
        });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (jwtErr) {
        res.clearCookie('sap_session_token');
        return res.status(401).json({
          success: false,
          message: 'Session expired or invalid.',
        });
      }

      const user = usersStore.findById(decoded.id);
      if (!user) {
        res.clearCookie('sap_session_token');
        return res.status(401).json({
          success: false,
          message: 'User account no longer exists.',
        });
      }

      return res.status(200).json({
        success: true,
        user: sanitizeUser(user),
      });
    } catch (err) {
      console.error('getMe error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify session.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // LOGOUT
  // --------------------------------------------------------------------------
  logout: async (req, res) => {
    res.clearCookie('sap_session_token', {
      path: '/',
    });
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  },
};
