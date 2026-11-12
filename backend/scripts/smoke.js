/**
 * End-to-End Smoke Test Runner for Share A Plate
 *
 * Runs completely offline against mongodb-memory-server (NEVER touches Atlas or remote DBs).
 * Walks through the complete 13-step lifecycle using real HTTP requests:
 *   Step 1:  Seed users (admin & unverified recipients)
 *   Step 2:  Donor registers publicly and receives JWT token
 *   Step 3:  Admin verifies recipient account
 *   Step 4:  Donor creates food donation (status AVAILABLE)
 *   Step 5:  Recipient lists available donations (sees rounded location & safe area)
 *   Step 6:  Unverified recipient is blocked (403 UNVERIFIED_ACCOUNT)
 *   Step 7:  Donor edits available donation
 *   Step 8:  Donor uploads photo to donation & verifies static retrieval (nosniff)
 *   Step 9:  In-app notification created, retrieved, and marked as read
 *   Step 10: Donor cancels another donation before pickup
 *   Step 11: Public impact dashboard accessed without auth (zero PII)
 *   Step 12: Admin donation feed retrieved with countdown metrics
 *   Step 13: Deactivated user is locked out from API calls and login
 *   Step 14: CORS preflight verification (CLIENT_URL allowed, foreign origin blocked)
 */

// Set isolated test environment variables before any application module loads
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'share_a_plate_smoke_test_ephemeral_jwt_secret_min_32_chars!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

const sharp = require('sharp');
const app = require('../app');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const { createNotification } = require('../src/services/notificationService');
const { ROLES } = require('../src/constants/roles');
const ERROR_CODES = require('../src/constants/errorCodes');

let mongoServer;

const runStep = async (stepNumber, stepTitle, fn) => {
  try {
    await fn();
    console.log(`  [\x1b[32mPASS\x1b[0m] Step ${stepNumber}: ${stepTitle}`);
  } catch (err) {
    console.error(`  [\x1b[31mFAIL\x1b[0m] Step ${stepNumber}: ${stepTitle}`);
    console.error(`         Error: ${err.message}`);
    if (err.response) {
      console.error(`         Status: ${err.response.status}`);
      console.error(`         Body: ${JSON.stringify(err.response.body)}`);
    }
    throw err;
  }
};

async function main() {
  console.log('\n======================================================');
  console.log('  Share A Plate - End-to-End Smoke Verification Script');
  console.log('======================================================\n');

  // Start in-memory database
  console.log('Starting in-memory MongoDB server...');
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('In-memory MongoDB connected.\n');

  let adminUser, adminToken;
  let unverifiedRecipientUser, unverifiedRecipientToken;
  let recipientToVerify;
  let donorUser, donorToken;
  let verifiedRecipientToken;
  let donation1Id, donation2Id;
  let createdNotificationId;

  // Generate real JPEG fixture containing EXIF GPS tags
  const validSmokeJpegWithGps = await sharp({
    create: {
      width: 60,
      height: 60,
      channels: 3,
      background: { r: 240, g: 100, b: 20 },
    },
  })
    .withExif({
      IFD0: {
        Make: 'Apple',
        Model: 'iPhone 15 Pro',
      },
      GPSInfo: {
        GPSLatitude: '12/1 58/1 0/1',
        GPSLatitudeRef: 'N',
        GPSLongitude: '77/1 35/1 0/1',
        GPSLongitudeRef: 'E',
      },
    })
    .jpeg()
    .toBuffer();

  try {
    // -------------------------------------------------------------------------
    // Step 1: Seed users
    // -------------------------------------------------------------------------
    await runStep(1, 'Seed initial administrative and recipient accounts', async () => {
      adminUser = await User.create({
        name: 'Head Administrator',
        email: 'admin@smoke.org',
        password: 'Password123!',
        role: ROLES.ADMIN,
        phone: '+919999999991',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        address: { city: 'Bengaluru', formattedAddress: 'City Hall, Bengaluru' },
      });

      recipientToVerify = await User.create({
        name: 'Community Food Kitchen',
        email: 'kitchen@smoke.org',
        password: 'Password123!',
        role: ROLES.RECIPIENT,
        phone: '+919999999992',
        isVerified: false,
        isActive: true,
        location: { type: 'Point', coordinates: [77.60, 12.98] },
        address: { city: 'Bengaluru', formattedAddress: 'Community Center, Bengaluru' },
      });

      unverifiedRecipientUser = await User.create({
        name: 'Unverified Shelter',
        email: 'unverified@smoke.org',
        password: 'Password123!',
        role: ROLES.RECIPIENT,
        phone: '+919999999993',
        isVerified: false,
        isActive: true,
        location: { type: 'Point', coordinates: [77.61, 12.99] },
        address: { city: 'Bengaluru', formattedAddress: 'Shelter Hub, Bengaluru' },
      });

      // Login admin to obtain admin token
      const adminLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@smoke.org', password: 'Password123!' });
      if (adminLoginRes.status !== 200) throw new Error('Admin login failed');
      adminToken = adminLoginRes.body.data.token;
    });

    // -------------------------------------------------------------------------
    // Step 2: Donor registers
    // -------------------------------------------------------------------------
    await runStep(2, 'Donor registers publicly and receives JWT token', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Green Leaf Restaurant',
          email: 'donor@smoke.org',
          password: 'Password123!',
          role: ROLES.DONOR,
          phone: '+919876543210',
          location: {
            type: 'Point',
            coordinates: [77.594628, 12.971598],
          },
          address: {
            street: '77 Brigade Road',
            city: 'Bengaluru',
            formattedAddress: '77 Brigade Road, Bengaluru',
          },
        });

      if (registerRes.status !== 201) {
        const err = new Error('Donor registration failed');
        err.response = registerRes;
        throw err;
      }
      donorUser = registerRes.body.data.user;
      donorToken = registerRes.body.data.token;
      if (!donorToken) throw new Error('No JWT token returned on registration');
    });

    // -------------------------------------------------------------------------
    // Step 3: Admin verifies recipient
    // -------------------------------------------------------------------------
    await runStep(3, 'Admin verifies recipient account via PATCH /admin/users/:id/verify', async () => {
      const verifyRes = await request(app)
        .patch(`/api/v1/admin/users/${recipientToVerify._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (verifyRes.status !== 200 || !verifyRes.body.data.user.isVerified) {
        const err = new Error('Admin verification endpoint failed');
        err.response = verifyRes;
        throw err;
      }

      // Login the newly verified recipient to get their token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'kitchen@smoke.org', password: 'Password123!' });
      if (loginRes.status !== 200) throw new Error('Verified recipient login failed');
      verifiedRecipientToken = loginRes.body.data.token;
    });

    // -------------------------------------------------------------------------
    // Step 4: Donor creates food donation
    // -------------------------------------------------------------------------
    await runStep(4, 'Donor creates food donation (status AVAILABLE)', async () => {
      const now = Date.now();
      const donationPayload = {
        foodName: 'Hot Vegetable Biryani',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 40,
        unit: 'plates',
        cookedAt: new Date(now - 3600000).toISOString(),
        expiryAt: new Date(now + 4 * 3600000).toISOString(),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(now + 1800000).toISOString(),
        pickupWindowEnd: new Date(now + 2.5 * 3600000).toISOString(),
        location: {
          type: 'Point',
          coordinates: [77.594628, 12.971598],
        },
        address: {
          street: '77 Brigade Road, Suite 4',
          city: 'Bengaluru',
          formattedAddress: '77 Brigade Road, Suite 4, Bengaluru',
        },
      };

      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(donationPayload);

      if (res.status !== 201 || res.body.data.status !== 'AVAILABLE') {
        const err = new Error('Donation creation failed');
        err.response = res;
        throw err;
      }
      donation1Id = res.body.data.id || res.body.data._id;
    });

    // -------------------------------------------------------------------------
    // Step 5: Recipient lists available (sees rounded location & safe area)
    // -------------------------------------------------------------------------
    await runStep(5, 'Recipient lists available donations and sees rounded location', async () => {
      const res = await request(app)
        .get('/api/v1/donations/available')
        .set('Authorization', `Bearer ${verifiedRecipientToken}`);

      if (res.status !== 200 || !res.body.data || res.body.data.length === 0) {
        const err = new Error('Failed to list available donations');
        err.response = res;
        throw err;
      }

      const item = res.body.data[0];
      // Check rounded coordinates (2 decimals: 77.59, 12.97)
      if (item.location.coordinates[0] !== 77.59 || item.location.coordinates[1] !== 12.97) {
        throw new Error(`Coordinates not rounded: ${JSON.stringify(item.location.coordinates)}`);
      }
      // Check masked street and donor phone
      if (item.address.street !== null) {
        throw new Error(`Street was not redacted: ${item.address.street}`);
      }
      if (item.donor && item.donor.phone !== null) {
        throw new Error(`Donor phone was not masked: ${item.donor.phone}`);
      }
    });

    // -------------------------------------------------------------------------
    // Step 6: Unverified recipient is blocked
    // -------------------------------------------------------------------------
    await runStep(6, 'Unverified recipient is blocked from accessing available donations (403)', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unverified@smoke.org', password: 'Password123!' });
      unverifiedRecipientToken = loginRes.body.data.token;

      const res = await request(app)
        .get('/api/v1/donations/available')
        .set('Authorization', `Bearer ${unverifiedRecipientToken}`);

      if (res.status !== 403 || res.body.error.code !== ERROR_CODES.UNVERIFIED_ACCOUNT) {
        const err = new Error(`Expected 403 UNVERIFIED_ACCOUNT, received ${res.status}`);
        err.response = res;
        throw err;
      }
    });

    // -------------------------------------------------------------------------
    // Step 7: Donor edits donation
    // -------------------------------------------------------------------------
    await runStep(7, 'Donor edits available donation (PATCH /donations/:id)', async () => {
      const res = await request(app)
        .patch(`/api/v1/donations/${donation1Id}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ instructions: 'Park at loading dock B for pickup' });

      if (res.status !== 200 || res.body.data.instructions !== 'Park at loading dock B for pickup') {
        const err = new Error('Donation edit failed');
        err.response = res;
        throw err;
      }
    });

    // -------------------------------------------------------------------------
    // Step 8: Donor uploads photo with GPS EXIF, verifies stripping & serving
    // -------------------------------------------------------------------------
    await runStep(8, 'Donor uploads photo with GPS EXIF, verifies stripping, serving & deletion', async () => {
      // 1. Verify source fixture contains GPS metadata
      const rawMeta = await sharp(validSmokeJpegWithGps).metadata();
      if (!rawMeta.exif) {
        throw new Error('Test fixture missing EXIF metadata');
      }

      // 2. Upload photo to donation
      const uploadRes = await request(app)
        .post(`/api/v1/donations/${donation1Id}/photos`)
        .set('Authorization', `Bearer ${donorToken}`)
        .attach('photos', validSmokeJpegWithGps, 'biryani_smoke_with_gps.jpg');

      if (uploadRes.status !== 200 || !uploadRes.body.success || !uploadRes.body.data.photos.length) {
        const err = new Error('Photo upload failed');
        err.response = uploadRes;
        throw err;
      }

      const photoObj = uploadRes.body.data.photos[0];
      const photoUrl = typeof photoObj === 'object' ? photoObj.url : photoObj;
      const photoId = typeof photoObj === 'object' ? photoObj.id : null;

      if (!photoUrl) {
        throw new Error('Photo URL is missing from upload response');
      }

      // 3. Static GET verification
      const staticRes = await request(app).get(photoUrl);

      if (staticRes.status !== 200 || staticRes.headers['x-content-type-options'] !== 'nosniff') {
        const err = new Error('Static photo serving or nosniff header verification failed');
        err.response = staticRes;
        throw err;
      }

      // 4. Verify EXIF and GPS tags are completely stripped
      const strippedMeta = await sharp(staticRes.body).metadata();
      if (strippedMeta.exif) {
        throw new Error('GPS/EXIF metadata was NOT stripped from uploaded photo');
      }

      // 5. Verify DELETE photo endpoint
      if (photoId) {
        const delRes = await request(app)
          .delete(`/api/v1/donations/${donation1Id}/photos/${photoId}`)
          .set('Authorization', `Bearer ${donorToken}`);

        if (delRes.status !== 200 || !delRes.body.success) {
          const err = new Error('Photo deletion failed');
          err.response = delRes;
          throw err;
        }

        const afterDelRes = await request(app).get(photoUrl);
        if (afterDelRes.status !== 404) {
          throw new Error('Deleted photo still served statically');
        }
      }
    });

    // -------------------------------------------------------------------------
    // Step 9: In-app notification creation & lifecycle
    // -------------------------------------------------------------------------
    await runStep(9, 'In-app notification created, retrieved, and marked as read', async () => {
      // 1. Create notification for recipient
      const notif = await createNotification(
        recipientToVerify._id,
        'EXPIRING_SOON',
        'Urgent Food Available',
        'A hot meal donation is available near your location.',
        donation1Id
      );
      createdNotificationId = notif._id;

      // 2. Fetch notifications for verified recipient
      const getRes = await request(app)
        .get('/api/v1/notifications?unread=true')
        .set('Authorization', `Bearer ${verifiedRecipientToken}`);

      if (getRes.status !== 200 || !getRes.body.data.notifications || getRes.body.data.unreadCount < 1) {
        const err = new Error('Failed to retrieve unread notifications');
        err.response = getRes;
        throw err;
      }

      // 3. Mark notification as read
      const markRes = await request(app)
        .patch(`/api/v1/notifications/${createdNotificationId}/read`)
        .set('Authorization', `Bearer ${verifiedRecipientToken}`);

      if (markRes.status !== 200 || !markRes.body.data.notification.readAt) {
        const err = new Error('Failed to mark notification as read');
        err.response = markRes;
        throw err;
      }
    });

    // -------------------------------------------------------------------------
    // Step 10: Donor cancels another donation
    // -------------------------------------------------------------------------
    await runStep(10, 'Donor cancels another donation before pickup (status CANCELLED)', async () => {
      const now = Date.now();
      const res2 = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          foodName: 'Surplus Sandwich Platter',
          foodType: 'cooked_meals',
          dietaryType: 'vegetarian',
          totalQuantity: 15,
          unit: 'plates',
          cookedAt: new Date(now - 1800000).toISOString(),
          expiryAt: new Date(now + 3 * 3600000).toISOString(),
          safetyBufferMinutes: 45,
          pickupWindowStart: new Date(now + 900000).toISOString(),
          pickupWindowEnd: new Date(now + 2 * 3600000).toISOString(),
          location: { type: 'Point', coordinates: [77.59, 12.97] },
          address: { street: 'Main Gate', city: 'Bengaluru', formattedAddress: 'Main Gate, Bengaluru' },
        });

      donation2Id = res2.body.data.id || res2.body.data._id;

      const cancelRes = await request(app)
        .post(`/api/v1/donations/${donation2Id}/cancel`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ reason: 'Kitchen needed the supplies for banquet' });

      if (cancelRes.status !== 200 || cancelRes.body.data.status !== 'CANCELLED') {
        const err = new Error('Donation cancellation failed');
        err.response = cancelRes;
        throw err;
      }
    });

    // -------------------------------------------------------------------------
    // Step 11: Public impact endpoint
    // -------------------------------------------------------------------------
    await runStep(11, 'Public impact dashboard accessed without auth (zero PII)', async () => {
      const res = await request(app).get('/api/v1/dashboard/impact');

      if (res.status !== 200 || !res.body.success) {
        const err = new Error('Public impact dashboard failed');
        err.response = res;
        throw err;
      }

      const raw = JSON.stringify(res.body.data);
      if (raw.includes('@') || raw.includes('+91') || raw.includes('donor') || raw.includes('Brigade')) {
        throw new Error('PII detected in public impact response');
      }

      // Assert documented fields
      const expectedKeys = [
        'mealsSaved',
        'percentCompletedBeforeExpiry',
        'avgTimeToMatchMinutes',
        'totalDonationsPosted',
        'totalDonationsCompleted',
        'activeDonationsCount',
        'registeredDonorsCount',
        'registeredRecipientsCount',
      ];
      for (const k of expectedKeys) {
        if (res.body.data[k] === undefined) {
          throw new Error(`Missing expected key in impact dashboard: ${k}`);
        }
      }
    });

    // -------------------------------------------------------------------------
    // Step 12: Admin donation feed
    // -------------------------------------------------------------------------
    await runStep(12, 'Admin retrieves full donation audit feed with countdown metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/donations?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200 || !res.body.data || res.body.data.length < 2) {
        const err = new Error('Admin donation feed failed');
        err.response = res;
        throw err;
      }

      const item = res.body.data[0];
      if (item.secondsToEffectiveExpiry === undefined || item.statusHistoryLength === undefined) {
        throw new Error('Missing admin countdown or history metrics in donation feed item');
      }
    });

    // -------------------------------------------------------------------------
    // Step 13: Deactivated user is locked out
    // -------------------------------------------------------------------------
    await runStep(13, 'Deactivated user is locked out from API calls and login', async () => {
      // 1. Admin deactivates donor
      const deactRes = await request(app)
        .patch(`/api/v1/admin/users/${donorUser.id || donorUser._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (deactRes.status !== 200 || deactRes.body.data.user.isActive !== false) {
        const err = new Error('Admin user deactivation failed');
        err.response = deactRes;
        throw err;
      }

      // 2. Existing donor token is rejected on authenticated API call
      const apiRes = await request(app)
        .get('/api/v1/donations/my')
        .set('Authorization', `Bearer ${donorToken}`);

      if (apiRes.status !== 403 || apiRes.body.error.code !== ERROR_CODES.DEACTIVATED_ACCOUNT) {
        const err = new Error(`Expected 403 DEACTIVATED_ACCOUNT, got ${apiRes.status}`);
        err.response = apiRes;
        throw err;
      }

      // 3. Login attempt with valid password is also blocked
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'donor@smoke.org', password: 'Password123!' });

      if (loginRes.status !== 403 || loginRes.body.error.code !== ERROR_CODES.DEACTIVATED_ACCOUNT) {
        const err = new Error(`Expected 403 DEACTIVATED_ACCOUNT on login, got ${loginRes.status}`);
        err.response = loginRes;
        throw err;
      }
    });

    // -------------------------------------------------------------------------
    // Step 14: CORS preflight verification for CLIENT_URL & foreign origin
    // -------------------------------------------------------------------------
    await runStep(14, 'CORS preflight from CLIENT_URL allowed with multipart headers, foreign origin blocked', async () => {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

      // 1. Preflight OPTIONS request from whitelisted CLIENT_URL with Authorization and multipart upload headers
      const preflightRes = await request(app)
        .options(`/api/v1/donations/${donation1Id}/photos`)
        .set('Origin', clientUrl)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type');

      if (preflightRes.status !== 200 && preflightRes.status !== 204) {
        throw new Error(`Expected preflight status 200/204, received ${preflightRes.status}`);
      }

      const allowOrigin = preflightRes.headers['access-control-allow-origin'];
      if (allowOrigin !== clientUrl) {
        throw new Error(`Expected Access-Control-Allow-Origin to be ${clientUrl}, got: ${allowOrigin}`);
      }

      // 2. Preflight request from unauthorized foreign origin
      const foreignRes = await request(app)
        .options(`/api/v1/donations/${donation1Id}/photos`)
        .set('Origin', 'http://unauthorized-attacker.example')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type');

      const foreignAllowOrigin = foreignRes.headers['access-control-allow-origin'];
      if (foreignAllowOrigin) {
        throw new Error(`Expected foreign origin to be blocked, but Access-Control-Allow-Origin was set to: ${foreignAllowOrigin}`);
      }
    });

    console.log('\n======================================================');
    console.log('  \x1b[32m✔ ALL 14 END-TO-END SMOKE TEST STEPS PASSED!\x1b[0m');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

main().catch((err) => {
  console.error('\nSmoke test script encountered a fatal error:', err);
  process.exit(1);
});
