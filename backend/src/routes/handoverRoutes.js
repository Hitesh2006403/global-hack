const express = require('express');
const handoverController = require('../controllers/handoverController');

const router = express.Router();

// Real-time Server-Sent Events stream
router.get('/stream', handoverController.streamEvents);

// Stage 1: Donor generates / retrieves pickup QR token
router.get('/donations/:donationId/pickup-token', handoverController.getOrCreatePickupToken);
router.post('/donations/:donationId/pickup-token', handoverController.getOrCreatePickupToken);

// Stage 2: Delivery Agent scans donor QR and confirms physical collection
router.post('/verify-pickup-scan', handoverController.verifyPickupScan);
router.post('/confirm-pickup', handoverController.confirmPickup);

// Stage 2 / 3: Delivery Agent presents receipt token to recipient
router.get('/donations/:donationId/receipt-token', handoverController.getReceiptToken);

// Stage 3: Recipient scans delivery agent QR and confirms receipt
router.post('/verify-receipt-scan', handoverController.verifyReceiptScan);
router.post('/confirm-receipt', handoverController.confirmReceipt);

// Query status and audit trail
router.get('/status/:donationId', handoverController.getStatus);

module.exports = router;
