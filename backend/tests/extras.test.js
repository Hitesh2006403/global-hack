const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const Notification = require('../src/models/Notification');
const VoiceCall = require('../src/models/VoiceCall');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS } = require('../src/constants/status');
const ERROR_CODES = require('../src/constants/errorCodes');
const authService = require('../src/services/authService');
const { createUrgencyNotifications } = require('../src/services/notificationService');
const sharp = require('sharp');
const { CloudinaryStorageAdapter } = require('../src/services/cloudinaryStorageAdapter');
const { validateProductionEnv, validateStorageConfig } = require('../server');

describe('Extras & Advanced Security Features Suite', () => {
  let donorUser, donorToken;
  let otherDonorUser, otherDonorToken;
  let recipientUser, recipientToken;
  let adminUser, adminToken;

  let validJpegBuffer;
  let validPngBuffer;
  let gpsJpegBuffer;
  let oversizedDimensionsBuffer;
  let corruptedImageBuffer;

  const fakeImageBuffer = Buffer.from('This is definitely malicious text pretending to be an image!');

  beforeAll(async () => {
    validJpegBuffer = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    validPngBuffer = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    gpsJpegBuffer = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
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

    oversizedDimensionsBuffer = await sharp({
      create: {
        width: 8001,
        height: 10,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    corruptedImageBuffer = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.from('CORRUPTED_NON_DECODABLE_DATA_PAYLOAD'),
    ]);
  });

  const createTestDonation = async (donorId, overrides = {}) => {
    const now = new Date();
    return Donation.create({
      donorId,
      foodName: 'Nutritious Veg Meal Box',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 25,
      remainingQuantity: 25,
      unit: 'plates',
      cookedAt: new Date(now.getTime() - 30 * 60 * 1000),
      expiryAt: new Date(now.getTime() + 5 * 60 * 60 * 1000),
      safetyBufferMinutes: 60,
      pickupWindowStart: new Date(now.getTime() + 15 * 60 * 1000),
      pickupWindowEnd: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      packagingType: 'sealed_containers',
      instructions: 'Ring bell at back door',
      status: DONATION_STATUS.AVAILABLE,
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716],
      },
      address: {
        street: '12 MG Road, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        formattedAddress: '12 MG Road, Indiranagar, Bengaluru, Karnataka 560038',
      },
      ...overrides,
    });
  };

  beforeEach(async () => {
    donorUser = await User.create({
      name: 'Chef Anand',
      email: 'chef@kitchen.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919876543210',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Bengaluru, Karnataka' },
    });
    donorToken = authService.generateToken(donorUser._id);

    otherDonorUser = await User.create({
      name: 'Pooja Caterer',
      email: 'pooja@kitchen.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919876543211',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.60, 12.98] },
      address: { city: 'Bengaluru', formattedAddress: 'Bengaluru, Karnataka' },
    });
    otherDonorToken = authService.generateToken(otherDonorUser._id);

    recipientUser = await User.create({
      name: 'Shanti Shelter Home',
      email: 'shanti@shelter.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919876543212',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.61, 12.96] },
      address: { city: 'Bengaluru', formattedAddress: 'Bengaluru, Karnataka' },
    });
    recipientToken = authService.generateToken(recipientUser._id);

    adminUser = await User.create({
      name: 'Admin Supervisor',
      email: 'admin@platform.org',
      password: 'Password123!',
      role: ROLES.ADMIN,
      phone: '+919876543213',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Bengaluru, Karnataka' },
    });
    adminToken = authService.generateToken(adminUser._id);
  });

  // ============================================================================
  // 1. ADDRESS PRIVACY: Zero street leakage under various formats
  // ============================================================================
  describe('1. Address Privacy & Zero Street Leakage', () => {
    it('guarantees street never appears for unattached viewer under standard format', async () => {
      const donation = await createTestDonation(donorUser._id, {
        address: {
          street: '12 MG Road, Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560038',
          formattedAddress: '12 MG Road, Indiranagar, Bengaluru, Karnataka 560038',
        },
      });

      const res = await request(app)
        .get(`/api/v1/donations/${donation._id}`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const donationData = res.body.data;

      // Street must be null / stripped
      expect(donationData.address.street).toBeNull();
      // Safe area must be returned
      expect(donationData.address.area).toBe('Bengaluru, Karnataka');
      expect(donationData.address.formattedAddress).toBe('Bengaluru, Karnataka');
      // Zero leakage assertion
      expect(donationData.address.formattedAddress).not.toContain('12 MG Road');
      expect(donationData.address.formattedAddress).not.toContain('Indiranagar');
      // Phone must be null
      expect(donationData.donorPhone).toBeNull();
    });

    it('guarantees street never appears for lowercase and informal formats', async () => {
      const donation = await createTestDonation(donorUser._id, {
        address: {
          street: 'flat 4b, 3rd cross, koramangala',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560034',
          formattedAddress: 'flat 4b, 3rd cross, koramangala, bengaluru, karnataka 560034',
        },
      });

      const res = await request(app)
        .get(`/api/v1/donations/${donation._id}`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const donationData = res.body.data;

      expect(donationData.address.street).toBeNull();
      expect(donationData.address.formattedAddress).not.toContain('flat 4b');
      expect(donationData.address.formattedAddress).not.toContain('3rd cross');
      expect(donationData.address.formattedAddress).not.toContain('koramangala');
      expect(donationData.address.formattedAddress).toBe('Bengaluru, Karnataka');
    });

    it('guarantees street never appears with abbreviations and symbols', async () => {
      const donation = await createTestDonation(donorUser._id, {
        address: {
          street: '12/A 1st Flr, St. Marks Rd, Blr',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          formattedAddress: '12/A 1st Flr, St. Marks Rd, Blr, Karnataka 560001',
        },
      });

      const res = await request(app)
        .get(`/api/v1/donations/${donation._id}`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const donationData = res.body.data;

      expect(donationData.address.street).toBeNull();
      expect(donationData.address.formattedAddress).not.toContain('12/A');
      expect(donationData.address.formattedAddress).not.toContain('St. Marks Rd');
      expect(donationData.address.formattedAddress).toBe('Bengaluru, Karnataka');
    });

    it('allows custom areaLabel and preserves it in unattached view', async () => {
      const donation = await createTestDonation(donorUser._id, {
        areaLabel: 'Indiranagar Hub, Bengaluru',
        address: {
          street: 'Private Bungalow 88, 100ft Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560038',
          formattedAddress: 'Private Bungalow 88, 100ft Road, Bengaluru 560038',
        },
      });

      const res = await request(app)
        .get(`/api/v1/donations/${donation._id}`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const donationData = res.body.data;

      expect(donationData.address.street).toBeNull();
      expect(donationData.address.formattedAddress).toBe('Indiranagar Hub, Bengaluru');
      expect(donationData.address.formattedAddress).not.toContain('Private Bungalow 88');
      expect(donationData.address.formattedAddress).not.toContain('100ft Road');
    });

    it('provides full unmasked address and phone to the owner donor and admin', async () => {
      const donation = await createTestDonation(donorUser._id);

      // Donor owner view
      const ownerRes = await request(app)
        .get(`/api/v1/donations/${donation._id}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.data.address.street).toBe('12 MG Road, Indiranagar');
      expect(ownerRes.body.data.donorPhone).toBe('+919876543210');

      // Admin view
      const adminRes = await request(app)
        .get(`/api/v1/donations/${donation._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.address.street).toBe('12 MG Road, Indiranagar');
      expect(adminRes.body.data.donorPhone).toBe('+919876543210');
    });
  });

  // ============================================================================
  // 2. PHOTO UPLOADS, HARDENING & FILE PROTECTION
  // ============================================================================
  describe('2. Photo Uploads, Hardening & File Protection', () => {
    it('successfully uploads valid JPEG photo and updates donation photos array with { id, url }', async () => {
      const donation = await createTestDonation(donorUser._id);

      const res = await request(app)
        .post(`/api/v1/donations/${donation._id}/photos`)
        .set('Authorization', `Bearer ${donorToken}`)
        .attach('photos', validJpegBuffer, 'food1.jpg');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.photos.length).toBe(1);
      expect(res.body.data.photos[0].id).toBeDefined();
      expect(res.body.data.photos[0].url).toMatch(/^\/uploads\/[a-zA-Z0-9_-]+\.jpg$/);
      // internal publicId should never leak in API output
      expect(res.body.data.photos[0].publicId).toBeUndefined();

      // Verify file is persisted in DB with publicId
      const updated = await Donation.findById(donation._id);
      expect(updated.photos.length).toBe(1);
      expect(updated.photos[0].url).toBe(res.body.data.photos[0].url);
      expect(updated.photos[0].publicId).toBeDefined();

      // Verify static route serves the uploaded file with security headers
      const staticRes = await request(app).get(res.body.data.photos[0].url);
      expect(staticRes.status).toBe(200);
      expect(staticRes.headers['x-content-type-options']).toBe('nosniff');
    });

    it('strips all EXIF, GPS, and camera metadata upon upload (privacy protection)', async () => {
      // First verify the fixture buffer DOES contain EXIF/GPS metadata
      const fixtureMetadata = await sharp(gpsJpegBuffer).metadata();
      expect(fixtureMetadata.exif).toBeDefined();

      const donation = await createTestDonation(donorUser._id);
      const res = await request(app)
        .post(`/api/v1/donations/${donation._id}/photos`)
        .set('Authorization', `Bearer ${donorToken}`)
        .attach('photos', gpsJpegBuffer, 'with_gps.jpg');

      expect(res.status).toBe(200);
      const photoUrl = res.body.data.photos[0].url;

      // Fetch the served file from disk via the static endpoint
      const staticRes = await request(app).get(photoUrl);
      expect(staticRes.status).toBe(200);

      // Verify EXIF and GPS tags are completely absent in the processed file
      const processedMeta = await sharp(staticRes.body).metadata();
      expect(processedMeta.exif).toBeUndefined();
    });

    it('rejects upload with spoofed magic bytes (fake text file named image.jpg)', async () => {
      const donation = await createTestDonation(donorUser._id);

      const res = await request(app)
        .post(`/api/v1/donations/${donation._id}/photos`)
        .set('Authorization', `Bearer ${donorToken}`)
        .attach('photos', fakeImageBuffer, 'spoofed.jpg');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('rejects corrupted image file that passes magic bytes but fails decoding', async () => {
      const donation = await createTestDonation(donorUser._id);

      const res = await request(app)
        .post(`/api/v1/donations/${donation._id}/photos`)
        .set('Authorization', `Bearer ${donorToken}`)
        .attach('photos', corruptedImageBuffer, 'corrupt.jpg');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.error.message).toContain('Invalid or corrupted image file');
    });

    it('rejects image with oversized dimensions exceeding 8000x8000 (decompression bomb protection)', async () => {
      const donation = await createTestDonation(donorUser._id);

      const res = await request(app)
        .post(`/api/v1/donations/${donation._id}/photos`)
        .set('Authorization', `Bearer ${donorToken}`)
        .attach('photos', oversizedDimensionsBuffer, 'huge_dimension.jpg');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.error.message).toContain('exceed maximum allowed dimensions');
    });

    it('rejects non-owner donor attempting photo upload', async () => {
      const donation = await createTestDonation(donorUser._id);

      const res = await request(app)
        .post(`/api/v1/donations/${donation._id}/photos`)
        .set('Authorization', `Bearer ${otherDonorToken}`)
        .attach('photos', validJpegBuffer, 'food.jpg');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('rejects uploads exceeding 5 total images limit', async () => {
      const donation = await createTestDonation(donorUser._id, {
        photos: [
          '/uploads/img1.jpg',
          '/uploads/img2.jpg',
          '/uploads/img3.jpg',
          '/uploads/img4.jpg',
        ],
      });

      // Attempt to upload 2 photos when 4 already exist (4 + 2 = 6 > 5)
      const res = await request(app)
        .post(`/api/v1/donations/${donation._id}/photos`)
        .set('Authorization', `Bearer ${donorToken}`)
        .attach('photos', validJpegBuffer, 'foodA.jpg')
        .attach('photos', validPngBuffer, 'foodB.png');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('maximum 5 allowed');
    });

    it('rejects oversized image exceeding 2 MB limit', async () => {
      const donation = await createTestDonation(donorUser._id);
      const oversizedBuffer = Buffer.alloc(2 * 1024 * 1024 + 10, 0xff);

      const res = await request(app)
        .post(`/api/v1/donations/${donation._id}/photos`)
        .set('Authorization', `Bearer ${donorToken}`)
        .attach('photos', oversizedBuffer, 'oversized.jpg');

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(['FILE_TOO_LARGE', 'PAYLOAD_TOO_LARGE']).toContain(res.body.error.code);
    });

    it('blocks path traversal and malformed filenames on static uploads route', async () => {
      // 1. Path traversal attempt with dot-dots
      const traversalRes1 = await request(app).get('/uploads/..%2f..%2fpackage.json');
      expect([400, 404]).toContain(traversalRes1.status);

      // 2. Disallowed extension
      const invalidExtRes = await request(app).get('/uploads/malicious_script.sh');
      expect(invalidExtRes.status).toBe(400);
      expect(invalidExtRes.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);

      // 3. Non-existent file
      const nonExistentRes = await request(app).get('/uploads/00000000-0000-0000-0000-000000000000.jpg');
      expect(nonExistentRes.status).toBe(404);
      expect(nonExistentRes.body.error.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
    });

    describe('DELETE /api/v1/donations/:id/photos/:photoId Endpoint', () => {
      it('allows owner donor to delete a photo from an AVAILABLE donation', async () => {
        const donation = await createTestDonation(donorUser._id);

        const uploadRes = await request(app)
          .post(`/api/v1/donations/${donation._id}/photos`)
          .set('Authorization', `Bearer ${donorToken}`)
          .attach('photos', validJpegBuffer, 'delete_me.jpg');

        expect(uploadRes.status).toBe(200);
        const photoId = uploadRes.body.data.photos[0].id;
        const photoUrl = uploadRes.body.data.photos[0].url;

        // Verify photo exists statically
        const beforeCheck = await request(app).get(photoUrl);
        expect(beforeCheck.status).toBe(200);

        // Delete photo
        const delRes = await request(app)
          .delete(`/api/v1/donations/${donation._id}/photos/${photoId}`)
          .set('Authorization', `Bearer ${donorToken}`);

        expect(delRes.status).toBe(200);
        expect(delRes.body.success).toBe(true);
        expect(delRes.body.data.photos.length).toBe(0);

        // DB check
        const inDb = await Donation.findById(donation._id);
        expect(inDb.photos.length).toBe(0);

        // Local asset removed from disk
        const afterCheck = await request(app).get(photoUrl);
        expect(afterCheck.status).toBe(404);
      });

      it('rejects non-owner donor from deleting photo with 403 FORBIDDEN', async () => {
        const donation = await createTestDonation(donorUser._id);
        const uploadRes = await request(app)
          .post(`/api/v1/donations/${donation._id}/photos`)
          .set('Authorization', `Bearer ${donorToken}`)
          .attach('photos', validJpegBuffer, 'keep_me.jpg');

        const photoId = uploadRes.body.data.photos[0].id;

        const res = await request(app)
          .delete(`/api/v1/donations/${donation._id}/photos/${photoId}`)
          .set('Authorization', `Bearer ${otherDonorToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
      });

      it('returns 404 NOT_FOUND when photoId does not exist on donation', async () => {
        const donation = await createTestDonation(donorUser._id);

        const res = await request(app)
          .delete(`/api/v1/donations/${donation._id}/photos/non-existent-photo-uuid`)
          .set('Authorization', `Bearer ${donorToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
      });

      it('rejects photo deletion with 409 when donation status is not AVAILABLE or has claims', async () => {
        const donation = await createTestDonation(donorUser._id, {
          status: DONATION_STATUS.CANCELLED,
        });

        const res = await request(app)
          .delete(`/api/v1/donations/${donation._id}/photos/some-id`)
          .set('Authorization', `Bearer ${donorToken}`);

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe(ERROR_CODES.INVALID_STATUS_TRANSITION);
      });
    });
  });

  // ============================================================================
  // 3. IN-APP NOTIFICATIONS
  // ============================================================================
  describe('3. In-App Notifications Management', () => {
    it('lists user notifications with pagination and unread counts', async () => {
      await Notification.create([
        {
          userId: recipientUser._id,
          type: 'STATUS_UPDATE',
          title: 'Donation Ready',
          message: 'Donation is ready for pickup',
        },
        {
          userId: recipientUser._id,
          type: 'EXPIRING_SOON',
          title: 'Expiring Alert',
          message: 'Donation has 20m left',
          readAt: new Date(),
        },
        {
          userId: donorUser._id,
          type: 'CLAIMED',
          title: 'Your donation was claimed',
          message: 'Recipient claimed 10 plates',
        },
      ]);

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${recipientUserToken = recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.length).toBe(2);
      expect(res.body.data.unreadCount).toBe(1);

      // Filter by unread=true
      const unreadRes = await request(app)
        .get('/api/v1/notifications?unread=true')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(unreadRes.status).toBe(200);
      expect(unreadRes.body.data.notifications.length).toBe(1);
      expect(unreadRes.body.data.notifications[0].title).toBe('Donation Ready');
    });

    it('marks a single notification as read with IDOR protection', async () => {
      const recipientNotification = await Notification.create({
        userId: recipientUser._id,
        type: 'STATUS_UPDATE',
        title: 'Recipient Notice',
        message: 'Your order was processed',
      });

      // Unauthorized user (donor) attempts to mark recipient's notification as read
      const idorRes = await request(app)
        .patch(`/api/v1/notifications/${recipientNotification._id}/read`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(idorRes.status).toBe(403);
      expect(idorRes.body.error.code).toBe(ERROR_CODES.FORBIDDEN);

      // Legitimate owner marks as read
      const legitRes = await request(app)
        .patch(`/api/v1/notifications/${recipientNotification._id}/read`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(legitRes.status).toBe(200);
      expect(legitRes.body.data.notification.readAt).not.toBeNull();
    });

    it('marks all notifications as read for current user', async () => {
      await Notification.create([
        {
          userId: donorUser._id,
          type: 'CLAIMED',
          title: 'Claim 1',
          message: 'Portion claimed',
        },
        {
          userId: donorUser._id,
          type: 'EXPIRING_SOON',
          title: 'Urgent 1',
          message: 'Expiring soon',
        },
      ]);

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.markedReadCount).toBe(2);

      const unread = await Notification.countDocuments({ userId: donorUser._id, readAt: null });
      expect(unread).toBe(0);
    });

    it('deduplicates urgent notifications generated by sweeper', async () => {
      const now = new Date();
      // Donation with 20 minutes left to effective expiry (threshold = 30m)
      const urgentDonation = await createTestDonation(donorUser._id, {
        expiryAt: new Date(now.getTime() + 80 * 60 * 1000), // 80m
        safetyBufferMinutes: 60, // effective = 20m left
      });

      // First run generates 1 notification
      const count1 = await createUrgencyNotifications(30);
      expect(count1).toBe(1);

      // Second run is deduplicated
      const count2 = await createUrgencyNotifications(30);
      expect(count2).toBe(0);

      const notifs = await Notification.find({ donationId: urgentDonation._id });
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe('EXPIRING_SOON');
    });
  });

  // ============================================================================
  // 4. AI VOICE CALL STUB
  // ============================================================================
  describe('4. AI Voice Call Telephony Stub', () => {
    it('allows admin to trigger AI call and stores masked recipient phone', async () => {
      const donation = await createTestDonation(donorUser._id);

      const res = await request(app)
        .post('/api/v1/notifications/ai-call/trigger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          donationId: donation._id.toString(),
          recipientPhone: '+919876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.call.callId).toMatch(/^call_mock_/);
      // Masked phone format
      expect(res.body.data.call.recipientPhone).toBe('+91******3210');
      expect(res.body.data.call.recipientPhone).not.toContain('987654');

      // Verify stored call record
      const call = await VoiceCall.findOne({ callId: res.body.data.call.callId });
      expect(call).not.toBeNull();
      expect(call.recipientPhone).toBe('+91******3210');
    });

    it('rejects non-admin users from triggering AI voice calls', async () => {
      const donation = await createTestDonation(donorUser._id);

      const res = await request(app)
        .post('/api/v1/notifications/ai-call/trigger')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({
          donationId: donation._id.toString(),
          recipientPhone: '+919876543210',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('allows admin to query call record and protects against unauthorized access', async () => {
      const donation = await createTestDonation(donorUser._id);

      const call = await VoiceCall.create({
        callId: 'call_mock_test_12345',
        recipientPhone: '+91******3210',
        donationId: donation._id,
        recipientId: recipientUser._id,
        status: 'COMPLETED',
        transcript: 'Automated urgent dispatch completed.',
      });

      // Admin access allowed
      const adminRes = await request(app)
        .get(`/api/v1/notifications/ai-call/${call._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.call.callId).toBe('call_mock_test_12345');

      // Target recipient allowed
      const recipientRes = await request(app)
        .get(`/api/v1/notifications/ai-call/${call._id}`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(recipientRes.status).toBe(200);

      // Unrelated donor rejected with 403
      const donorRes = await request(app)
        .get(`/api/v1/notifications/ai-call/${call._id}`)
        .set('Authorization', `Bearer ${otherDonorToken}`);

      expect(donorRes.status).toBe(403);
      expect(donorRes.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  // ============================================================================
  // 5. PRODUCTION STARTUP VALIDATION GUARD
  // ============================================================================
  describe('5. Production Startup Guard (validateProductionEnv)', () => {
    it('passes silently when NODE_ENV is test or development even with placeholder secrets', () => {
      expect(() => {
        validateProductionEnv({
          NODE_ENV: 'development',
          JWT_SECRET: 'change-me',
          MONGODB_URI: 'change-me',
        });
      }).not.toThrow();
    });

    it('throws Error in production when critical environment variables are missing', () => {
      expect(() => {
        validateProductionEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'a_very_strong_production_secret_key_1234567890',
          MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          // CLIENT_URL and QR_SIGNING_SECRET missing
        });
      }).toThrow(/Fatal Startup Guard/);
    });

    it('throws Error in production when secrets contain "change-me"', () => {
      expect(() => {
        validateProductionEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'change-me',
          MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          CLIENT_URL: 'https://shareaplate.org',
          QR_SIGNING_SECRET: 'change-me',
        });
      }).toThrow(/still contains placeholder "change-me"/);
    });

    it('passes when all production secrets are valid and secure', () => {
      expect(() => {
        validateProductionEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'a_very_secure_production_secret_key_at_least_32_characters_long',
          MONGODB_URI: 'mongodb+srv://produser:StrongPass123@cluster.mongodb.net/prod',
          CLIENT_URL: 'https://shareaplate.org',
          QR_SIGNING_SECRET: 'qr_secure_signing_secret_production_key_456789',
        });
      }).not.toThrow();
    });
  });

  // ============================================================================
  // 6. CLOUDINARY STORAGE ADAPTER & CONFIGURATION SUITE
  // ============================================================================
  describe('6. Cloudinary Storage Adapter & Configuration Suite', () => {
    it('throws fail-fast Error in CloudinaryStorageAdapter when credentials are missing', () => {
      expect(() => {
        new CloudinaryStorageAdapter({
          cloudName: '',
          apiKey: '',
          apiSecret: '',
        });
      }).toThrow(/Storage Fatal/);
    });

    it('throws fail-fast Error in CloudinaryStorageAdapter when credentials contain "change-me"', () => {
      expect(() => {
        new CloudinaryStorageAdapter({
          cloudName: 'change-me',
          apiKey: 'change-me',
          apiSecret: 'change-me',
        });
      }).toThrow(/Storage Fatal/);
    });

    it('throws in validateStorageConfig when STORAGE_PROVIDER=cloudinary with invalid credentials', () => {
      expect(() => {
        validateStorageConfig({
          STORAGE_PROVIDER: 'cloudinary',
          CLOUDINARY_CLOUD_NAME: 'change-me',
          CLOUDINARY_API_KEY: 'abc',
          CLOUDINARY_API_SECRET: 'def',
        });
      }).toThrow(/Fatal Startup Guard/);
    });

    it('passes validateStorageConfig when STORAGE_PROVIDER=cloudinary with valid non-placeholder credentials', () => {
      expect(() => {
        validateStorageConfig({
          STORAGE_PROVIDER: 'cloudinary',
          CLOUDINARY_CLOUD_NAME: 'real-cloud',
          CLOUDINARY_API_KEY: 'real-key-12345',
          CLOUDINARY_API_SECRET: 'real-secret-67890',
        });
      }).not.toThrow();
    });

    it('passes validateStorageConfig when STORAGE_PROVIDER=local regardless of cloudinary envs', () => {
      expect(() => {
        validateStorageConfig({
          STORAGE_PROVIDER: 'local',
        });
      }).not.toThrow();
    });

    it('successfully uploads and sanitizes via mocked Cloudinary upload_stream', async () => {
      const cloudinary = require('cloudinary').v2;

      // Mock upload_stream to return a controlled result without external network calls
      const originalUploadStream = cloudinary.uploader.upload_stream;
      cloudinary.uploader.upload_stream = jest.fn((options, callback) => {
        const { Writable } = require('stream');
        const mockStream = new Writable({
          write(chunk, encoding, next) {
            next();
          },
        });
        mockStream.on('finish', () => {
          callback(null, {
            secure_url:
              'https://res.cloudinary.com/demo/image/upload/v1234567890/shareaplate/donations/donation_test.jpg',
            public_id: 'shareaplate/donations/donation_test',
            format: 'jpg',
          });
        });
        return mockStream;
      });

      const adapter = new CloudinaryStorageAdapter({
        cloudName: 'test-cloud',
        apiKey: 'test-key-123',
        apiSecret: 'test-secret-456',
      });

      const result = await adapter.saveFile({
        buffer: validJpegBuffer,
        originalname: 'meal.jpg',
        mimetype: 'image/jpeg',
      });

      expect(result).toHaveProperty('id');
      expect(result.url).toBe(
        'https://res.cloudinary.com/demo/image/upload/v1234567890/shareaplate/donations/donation_test.jpg'
      );
      expect(result.publicId).toBe('shareaplate/donations/donation_test');
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalled();

      // Test deleteFile
      const originalDestroy = cloudinary.uploader.destroy;
      cloudinary.uploader.destroy = jest.fn().mockResolvedValue({ result: 'ok' });

      await adapter.deleteFile(result.url, result.publicId);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('shareaplate/donations/donation_test');

      // Restore mocks
      cloudinary.uploader.upload_stream = originalUploadStream;
      cloudinary.uploader.destroy = originalDestroy;
    });
  });
});
