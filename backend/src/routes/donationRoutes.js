const express = require('express');
const donationController = require('../controllers/donationController');
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const requireVerified = require('../middlewares/verificationMiddleware');
const validate = require('../middlewares/validateMiddleware');
const {
  createDonationSchema,
  updateDonationSchema,
  cancelDonationSchema,
} = require('../validations/donationValidation');
const { ROLES } = require('../constants/roles');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

// All donation endpoints require authentication
router.use(protect);

// ==============================================================================
// 1. STATIC ROUTES (Must be declared BEFORE /:id to prevent wildcard collision)
// ==============================================================================

// GET /api/v1/donations/my - Donor view of their own posted donations
router.get(
  '/my',
  authorizeRoles(ROLES.DONOR, ROLES.ADMIN),
  donationController.getMyDonations
);

// GET /api/v1/donations/available - Active discoverable donations for recipients/drivers
router.get(
  '/available',
  authorizeRoles(ROLES.RECIPIENT, ROLES.DELIVERY_AGENT, ROLES.ADMIN),
  requireVerified,
  donationController.getAvailableDonations
);

// POST /api/v1/donations - Create donation (Donor only)
router.post(
  '/',
  authorizeRoles(ROLES.DONOR, ROLES.ADMIN),
  validate({ body: createDonationSchema }),
  donationController.createDonation
);

// GET /api/v1/donations - Administrative / general listing
router.get(
  '/',
  donationController.listDonations
);

// ==============================================================================
// 2. PARAMETERIZED ROUTES (/:id)
// ==============================================================================

// GET /api/v1/donations/:id/status-history - Audit trail
router.get(
  '/:id/status-history',
  donationController.getStatusHistory
);

// POST /api/v1/donations/:id/cancel - Cancel donation before pickup
router.post(
  '/:id/cancel',
  validate({ body: cancelDonationSchema }),
  donationController.cancelDonation
);

// POST /api/v1/donations/:id/accept - Claim / accept donation
router.post(
  '/:id/accept',
  authorizeRoles(ROLES.RECIPIENT, ROLES.ADMIN),
  donationController.acceptDonation
);

// PATCH /api/v1/donations/:id/reopen - Reopen cancelled or remaining donation
router.patch(
  '/:id/reopen',
  authorizeRoles(ROLES.DONOR, ROLES.ADMIN),
  donationController.reopenDonation
);

// PATCH /api/v1/donations/:id - Edit unaccepted donation
router.patch(
  '/:id',
  validate({ body: updateDonationSchema }),
  donationController.updateDonation
);

// POST /api/v1/donations/:id/photos - Upload photos for donation (Owner donor only)
router.post(
  '/:id/photos',
  upload.array('photos', 5),
  donationController.uploadDonationPhotos
);

// DELETE /api/v1/donations/:id/photos/:photoId - Remove photo from donation (Owner donor only)
router.delete(
  '/:id/photos/:photoId',
  donationController.deleteDonationPhoto
);

// GET /api/v1/donations/:id - Single donation view with role-scoped PII redaction
router.get(
  '/:id',
  donationController.getDonationById
);

module.exports = router;
