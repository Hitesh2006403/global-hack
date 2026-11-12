import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { donationsStore } from '../data/donationsStore.js';
import { deliveryTasksStore } from '../data/deliveryTasksStore.js';
import { handoverStore } from '../data/handoverStore.js';
import { auditStore } from '../data/auditStore.js';
import { usersStore } from '../data/usersStore.js';

const JWT_SECRET = process.env.JWT_SECRET || 'share-a-plate-super-secure-jwt-secret-2026';

// Server-Sent Events subscribers registry for real-time synchronization
const sseClients = new Set();

export const broadcastHandoverEvent = (event) => {
  const data = `data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch (err) {
      console.error('Error broadcasting SSE event:', err);
      sseClients.delete(res);
    }
  }
};

// Rate limiter helper for token scan guessing prevention
const failedAttemptsMap = new Map(); // ip_or_userId -> { count, lastAttempt }
const checkRateLimit = (key) => {
  const now = Date.now();
  const record = failedAttemptsMap.get(key) || { count: 0, lastAttempt: now };
  if (now - record.lastAttempt > 5 * 60 * 1000) {
    record.count = 0;
  }
  if (record.count >= 10) {
    return false; // Rate limited
  }
  return true;
};
const recordFailedAttempt = (key) => {
  const now = Date.now();
  const record = failedAttemptsMap.get(key) || { count: 0, lastAttempt: now };
  record.count += 1;
  record.lastAttempt = now;
  failedAttemptsMap.set(key, record);
};
const resetRateLimit = (key) => {
  failedAttemptsMap.delete(key);
};

// Authentication extractor
const resolveUser = (req) => {
  // Check cookie or header
  const token = req.cookies?.sap_session_token || req.headers?.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = usersStore.findById(decoded.id);
      if (user) return user;
    } catch {
      // ignore
    }
  }

  // Fallback for role switching or custom header in dev
  const headerUserId = req.headers['x-user-id'] || req.body?.userId;
  if (headerUserId) {
    const user = usersStore.findById(headerUserId);
    if (user) return user;
  }

  return null;
};

export const handoverController = {
  // --------------------------------------------------------------------------
  // REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
  // --------------------------------------------------------------------------
  streamEvents: (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Handover event stream active' })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  },

  // --------------------------------------------------------------------------
  // STAGE 1: DONOR GENERATES / FETCHES SECURE PICKUP QR CODE
  // --------------------------------------------------------------------------
  getOrCreatePickupToken: async (req, res) => {
    try {
      const { donationId } = req.params;
      const donation = donationsStore.findById(donationId);

      if (!donation) {
        return res.status(404).json({
          success: false,
          message: `Donation "${donationId}" not found.`,
        });
      }

      // Check current task for assigned agent
      const task = deliveryTasksStore.findByDonationId(donationId);
      const assignedAgentId = task?.deliveryAgentId || donation.assignedDeliveryAgentId || null;
      const recipientId = task?.dropoff?.recipientId || donation.matchedRecipients?.[0]?.recipientId || null;

      // Look for active token or create new one
      let tokenRecord = handoverStore.getActiveToken(donationId, 'PICKUP');

      if (!tokenRecord) {
        tokenRecord = handoverStore.createPickupToken({
          donationId,
          taskId: task?.id || null,
          donorId: donation.donorId,
          assignedAgentId,
          recipientId,
          expiryHours: 3,
        });

        // If donation was ASSIGNED, advance to READY_FOR_PICKUP
        if (donation.status === 'ASSIGNED' || donation.status === 'PARTIALLY_ACCEPTED') {
          donationsStore.update(donationId, { status: 'READY_FOR_PICKUP' });
          if (task && task.currentMilestone === 'ASSIGNED') {
            deliveryTasksStore.updateMilestone(task.id, 'READY_FOR_PICKUP');
          }
        }

        auditStore.record({
          action: 'PICKUP_TOKEN_GENERATED',
          donationId,
          taskId: task?.id,
          stage: 'PICKUP',
          userId: donation.donorId,
          userRole: 'donor',
          ip: req.ip,
          success: true,
          reason: 'Dynamic cryptographic pickup token generated for donor modal',
        });

        broadcastHandoverEvent({
          type: 'TOKEN_GENERATED',
          stage: 'PICKUP',
          donationId,
          status: 'READY_FOR_PICKUP',
        });
      }

      return res.status(200).json({
        success: true,
        token: {
          id: tokenRecord.id,
          donationId: tokenRecord.donationId,
          stage: tokenRecord.stage,
          rawToken: tokenRecord.rawToken,
          tokenHash: tokenRecord.tokenHash,
          signature: tokenRecord.signature,
          expiresAt: tokenRecord.expiresAt,
          status: tokenRecord.status,
          createdAt: tokenRecord.createdAt,
        },
        donation: {
          id: donation.id,
          foodName: donation.foodName,
          donorName: donation.donorName,
          status: donation.status,
          assignedDeliveryAgentId: assignedAgentId,
          deliveryAgentName: task?.deliveryAgentId ? 'Vikram Singh (Rider #42)' : null,
          pickupLocation: donation.pickupLocation,
        },
      });
    } catch (err) {
      console.error('getOrCreatePickupToken error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to generate pickup QR token.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // STAGE 2: DELIVERY AGENT SCANS DONOR'S QR CODE (VALIDATION)
  // --------------------------------------------------------------------------
  verifyPickupScan: async (req, res) => {
    try {
      const { token: inputToken, taskId, donationId: reqDonationId } = req.body;
      const rateLimitKey = `${req.ip}_${req.body.agentId || 'agent'}`;

      if (!checkRateLimit(rateLimitKey)) {
        auditStore.record({
          action: 'PICKUP_SCAN_ATTEMPT',
          donationId: reqDonationId,
          stage: 'PICKUP',
          userId: req.body.agentId,
          ip: req.ip,
          success: false,
          reason: 'Rate limit exceeded: too many failed attempts.',
        });
        return res.status(429).json({
          success: false,
          message: 'Too many invalid scan attempts. Please wait 5 minutes before trying again.',
        });
      }

      if (!inputToken) {
        return res.status(400).json({
          success: false,
          message: 'Handover token is required.',
        });
      }

      // Lookup token
      const tokenRecord = handoverStore.findToken(inputToken);

      if (!tokenRecord) {
        recordFailedAttempt(rateLimitKey);
        auditStore.record({
          action: 'PICKUP_SCAN_ATTEMPT',
          donationId: reqDonationId,
          stage: 'PICKUP',
          ip: req.ip,
          success: false,
          reason: 'Invalid token: no matching record found.',
        });
        return res.status(404).json({
          success: false,
          message: 'Invalid QR Code. This token does not match any registered food donation.',
        });
      }

      // Verify token belongs to PICKUP stage
      if (tokenRecord.stage !== 'PICKUP') {
        recordFailedAttempt(rateLimitKey);
        auditStore.record({
          action: 'PICKUP_SCAN_ATTEMPT',
          donationId: tokenRecord.donationId,
          stage: tokenRecord.stage,
          ip: req.ip,
          success: false,
          reason: `Stage mismatch: scanned a ${tokenRecord.stage} token instead of PICKUP token.`,
        });
        return res.status(400).json({
          success: false,
          message: `Stage Mismatch: This is a ${tokenRecord.stage} token, not a Donor Pickup token.`,
        });
      }

      // Verify token status
      if (tokenRecord.status === 'USED') {
        return res.status(409).json({
          success: false,
          message: 'Security Alert: This pickup token has already been used and cannot be reused.',
        });
      }
      if (tokenRecord.status === 'REVOKED') {
        return res.status(403).json({
          success: false,
          message: 'This pickup token has been revoked by the donor or system.',
        });
      }
      if (new Date(tokenRecord.expiresAt) <= new Date()) {
        return res.status(410).json({
          success: false,
          message: 'This pickup QR code has expired. Please ask the donor to refresh their screen.',
        });
      }

      // Verify donation exists and is ready for pickup
      const donation = donationsStore.findById(tokenRecord.donationId);
      if (!donation) {
        return res.status(404).json({
          success: false,
          message: 'Donation not found.',
        });
      }

      const task = taskId
        ? deliveryTasksStore.findById(taskId)
        : deliveryTasksStore.findByDonationId(donation.id);

      // Verify assigned delivery agent
      const requestingAgentId = req.body.agentId || 'user-delivery-1';
      if (tokenRecord.assignedAgentId && tokenRecord.assignedAgentId !== requestingAgentId) {
        auditStore.record({
          action: 'PICKUP_SCAN_ATTEMPT',
          donationId: donation.id,
          stage: 'PICKUP',
          userId: requestingAgentId,
          ip: req.ip,
          success: false,
          reason: 'Unauthorized delivery agent scanned donation.',
        });
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: You are not the assigned delivery partner for this food rescue.',
        });
      }

      resetRateLimit(rateLimitKey);

      auditStore.record({
        action: 'PICKUP_SCAN_ATTEMPT',
        donationId: donation.id,
        taskId: task?.id,
        stage: 'PICKUP',
        userId: requestingAgentId,
        userRole: 'delivery',
        ip: req.ip,
        success: true,
        reason: 'Pickup QR validated successfully. Awaiting physical collection confirmation.',
      });

      return res.status(200).json({
        success: true,
        message: 'QR Code verified! Please complete physical safety checklist to confirm pickup.',
        tokenRecord: {
          id: tokenRecord.id,
          donationId: tokenRecord.donationId,
          stage: tokenRecord.stage,
          expiresAt: tokenRecord.expiresAt,
        },
        donation: {
          id: donation.id,
          foodName: donation.foodName,
          donorName: donation.donorName,
          donorPhone: donation.donorPhone,
          initialQuantity: donation.initialQuantity,
          remainingQuantity: donation.remainingQuantity,
          unit: donation.unit,
          storageCondition: donation.storageCondition,
          pickupLocation: donation.pickupLocation,
          status: donation.status,
        },
        task: task || null,
      });
    } catch (err) {
      console.error('verifyPickupScan error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to verify pickup scan.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // STAGE 2 (CONT): DELIVERY AGENT CONFIRMS PHYSICAL COLLECTION
  // --------------------------------------------------------------------------
  confirmPickup: async (req, res) => {
    try {
      const { tokenId, token: rawToken, taskId, safetyChecklist, notes } = req.body;
      const agentId = req.body.agentId || 'user-delivery-1';

      let tokenRecord = tokenId ? handoverStore.getAllForDonation(req.body.donationId || '')?.find(t => t.id === tokenId) : null;
      if (!tokenRecord && rawToken) {
        tokenRecord = handoverStore.findToken(rawToken);
      }

      if (!tokenRecord) {
        return res.status(404).json({
          success: false,
          message: 'Valid pickup token record required to confirm pickup.',
        });
      }

      if (tokenRecord.stage !== 'PICKUP') {
        return res.status(400).json({
          success: false,
          message: 'Token must be a PICKUP stage token.',
        });
      }

      // Enforce 4 safety checkpoints
      if (
        !safetyChecklist ||
        !safetyChecklist.sealIntact ||
        !safetyChecklist.temperatureChecked ||
        !safetyChecklist.noSpillage ||
        !safetyChecklist.labelPresent
      ) {
        return res.status(400).json({
          success: false,
          message: 'All 4 mandatory food safety checkpoints must be verified before confirming pickup.',
        });
      }

      const donation = donationsStore.findById(tokenRecord.donationId);
      if (!donation) {
        return res.status(404).json({
          success: false,
          message: 'Associated donation not found.',
        });
      }

      // Check current state: must not already be picked up
      if (donation.status === 'PICKED_UP' || donation.status === 'DELIVERED' || donation.status === 'COMPLETED') {
        return res.status(409).json({
          success: false,
          message: `Donation is already in "${donation.status}" state. Duplicate pickup prevented.`,
        });
      }

      // ATOMIC TRANSACTION: Consume token and advance status
      const consumedToken = handoverStore.consumeToken(tokenRecord.id, agentId, 'delivery');

      const pickupTimestamp = new Date().toISOString();
      const updatedDonation = donationsStore.update(donation.id, {
        status: 'PICKED_UP',
        pickedUpAt: pickupTimestamp,
        pickedUpByAgentId: agentId,
      });

      // Update delivery task
      let task = taskId
        ? deliveryTasksStore.findById(taskId)
        : deliveryTasksStore.findByDonationId(donation.id);

      if (task) {
        task = deliveryTasksStore.updateMilestone(task.id, 'PICKED_UP', {
          pickedUpAt: pickupTimestamp,
          safetyChecklistCompleted: true,
          safetyChecklist,
          pickupNotes: notes || '',
        });
      }

      // GENERATE STAGE 2: RECIPIENT RECEIPT TOKEN
      const recipientId = task?.dropoff?.recipientId || donation.matchedRecipients?.[0]?.recipientId || 'user-recipient-1';
      const receiptTokenRecord = handoverStore.createReceiptToken({
        donationId: donation.id,
        taskId: task?.id || null,
        donorId: donation.donorId,
        assignedAgentId: agentId,
        recipientId,
        expiryHours: 4,
      });

      auditStore.record({
        action: 'PICKUP_CONFIRMED',
        donationId: donation.id,
        taskId: task?.id,
        stage: 'PICKUP',
        userId: agentId,
        userRole: 'delivery',
        ip: req.ip,
        success: true,
        reason: 'Physical food collection confirmed. Generated Stage 2 Recipient Receipt token.',
        metadata: { pickupTimestamp, receiptTokenId: receiptTokenRecord.id },
      });

      // Broadcast real-time status update to all connected portals
      broadcastHandoverEvent({
        type: 'PICKUP_CONFIRMED',
        donationId: donation.id,
        taskId: task?.id,
        status: 'PICKED_UP',
        pickupTimestamp,
        agentId,
      });

      return res.status(200).json({
        success: true,
        message: 'Food pickup confirmed! Donation is now marked as PICKED_UP.',
        donation: updatedDonation,
        task,
        receiptToken: {
          id: receiptTokenRecord.id,
          stage: receiptTokenRecord.stage,
          rawToken: receiptTokenRecord.rawToken,
          tokenHash: receiptTokenRecord.tokenHash,
          signature: receiptTokenRecord.signature,
          expiresAt: receiptTokenRecord.expiresAt,
          status: receiptTokenRecord.status,
        },
      });
    } catch (err) {
      console.error('confirmPickup error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to confirm pickup.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // STAGE 2 / 3: FETCH RECEIPT TOKEN (TO DISPLAY IN DELIVERY AGENT QR MODAL)
  // --------------------------------------------------------------------------
  getReceiptToken: async (req, res) => {
    try {
      const { donationId } = req.params;
      const donation = donationsStore.findById(donationId);

      if (!donation) {
        return res.status(404).json({
          success: false,
          message: 'Donation not found.',
        });
      }

      if (donation.status !== 'PICKED_UP' && donation.status !== 'DELIVERED') {
        return res.status(400).json({
          success: false,
          message: `Receipt token is only available after food has been picked up. Current status: ${donation.status}`,
        });
      }

      let receiptToken = handoverStore.getActiveToken(donationId, 'RECEIPT');
      const task = deliveryTasksStore.findByDonationId(donationId);

      if (!receiptToken) {
        const recipientId = task?.dropoff?.recipientId || donation.matchedRecipients?.[0]?.recipientId || 'user-recipient-1';
        receiptToken = handoverStore.createReceiptToken({
          donationId,
          taskId: task?.id || null,
          donorId: donation.donorId,
          assignedAgentId: task?.deliveryAgentId || 'user-delivery-1',
          recipientId,
          expiryHours: 4,
        });
      }

      return res.status(200).json({
        success: true,
        token: {
          id: receiptToken.id,
          donationId: receiptToken.donationId,
          stage: receiptToken.stage,
          rawToken: receiptToken.rawToken,
          tokenHash: receiptToken.tokenHash,
          signature: receiptToken.signature,
          expiresAt: receiptToken.expiresAt,
          status: receiptToken.status,
        },
        donation,
        task,
      });
    } catch (err) {
      console.error('getReceiptToken error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch receipt token.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // STAGE 3: RECIPIENT SCANS DELIVERY AGENT'S RECEIPT QR CODE (VALIDATION)
  // --------------------------------------------------------------------------
  verifyReceiptScan: async (req, res) => {
    try {
      const { token: inputToken, recipientId: reqRecipientId } = req.body;
      const rateLimitKey = `${req.ip}_${reqRecipientId || 'recipient'}`;

      if (!checkRateLimit(rateLimitKey)) {
        return res.status(429).json({
          success: false,
          message: 'Too many invalid attempts. Please wait 5 minutes before trying again.',
        });
      }

      if (!inputToken) {
        return res.status(400).json({
          success: false,
          message: 'Receipt token is required.',
        });
      }

      const tokenRecord = handoverStore.findToken(inputToken);

      if (!tokenRecord) {
        recordFailedAttempt(rateLimitKey);
        auditStore.record({
          action: 'RECEIPT_SCAN_ATTEMPT',
          stage: 'RECEIPT',
          ip: req.ip,
          success: false,
          reason: 'Invalid token: no matching record found.',
        });
        return res.status(404).json({
          success: false,
          message: 'Invalid QR Code. No delivery receipt matches this token.',
        });
      }

      // Verify stage is RECEIPT
      if (tokenRecord.stage !== 'RECEIPT') {
        recordFailedAttempt(rateLimitKey);
        auditStore.record({
          action: 'RECEIPT_SCAN_ATTEMPT',
          donationId: tokenRecord.donationId,
          stage: tokenRecord.stage,
          ip: req.ip,
          success: false,
          reason: `Stage mismatch: scanned a ${tokenRecord.stage} token instead of RECEIPT token.`,
        });
        return res.status(400).json({
          success: false,
          message: 'Stage Mismatch: This is a Pickup token, not a Delivery Receipt token.',
        });
      }

      // Check token status
      if (tokenRecord.status === 'USED') {
        return res.status(409).json({
          success: false,
          message: 'This delivery receipt token has already been confirmed and completed.',
        });
      }
      if (tokenRecord.status === 'REVOKED') {
        return res.status(403).json({
          success: false,
          message: 'This receipt token has been revoked.',
        });
      }
      if (new Date(tokenRecord.expiresAt) <= new Date()) {
        return res.status(410).json({
          success: false,
          message: 'Receipt token has expired. Please ask the delivery rider to regenerate.',
        });
      }

      // Verify donation status: must be PICKED_UP
      const donation = donationsStore.findById(tokenRecord.donationId);
      if (!donation) {
        return res.status(404).json({
          success: false,
          message: 'Donation record not found.',
        });
      }

      if (donation.status !== 'PICKED_UP' && donation.status !== 'DELIVERED') {
        return res.status(400).json({
          success: false,
          message: `Cannot confirm receipt before food has been picked up. Current status: ${donation.status}`,
        });
      }

      const task = deliveryTasksStore.findByDonationId(donation.id);

      // Verify intended recipient
      const requestingRecipientId = reqRecipientId || 'user-recipient-1';
      if (tokenRecord.recipientId && tokenRecord.recipientId !== requestingRecipientId) {
        auditStore.record({
          action: 'RECEIPT_SCAN_ATTEMPT',
          donationId: donation.id,
          stage: 'RECEIPT',
          userId: requestingRecipientId,
          ip: req.ip,
          success: false,
          reason: 'Unauthorized recipient scanned receipt token.',
        });
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: This donation is allocated for a different recipient organization.',
        });
      }

      resetRateLimit(rateLimitKey);

      auditStore.record({
        action: 'RECEIPT_SCAN_ATTEMPT',
        donationId: donation.id,
        taskId: task?.id,
        stage: 'RECEIPT',
        userId: requestingRecipientId,
        userRole: 'recipient',
        ip: req.ip,
        success: true,
        reason: 'Receipt QR validated successfully. Awaiting recipient confirmation.',
      });

      return res.status(200).json({
        success: true,
        message: 'Delivery QR verified! Please inspect the food and confirm receipt.',
        tokenRecord: {
          id: tokenRecord.id,
          donationId: tokenRecord.donationId,
          stage: tokenRecord.stage,
          expiresAt: tokenRecord.expiresAt,
        },
        donation: {
          id: donation.id,
          foodName: donation.foodName,
          donorName: donation.donorName,
          initialQuantity: donation.initialQuantity,
          remainingQuantity: donation.remainingQuantity,
          unit: donation.unit,
          storageCondition: donation.storageCondition,
          status: donation.status,
          pickedUpAt: donation.pickedUpAt,
        },
        task: task || null,
      });
    } catch (err) {
      console.error('verifyReceiptScan error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to verify receipt scan.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // STAGE 3 (CONT): RECIPIENT EXPLICITLY CONFIRMS FOOD RECEIPT & COMPLETION
  // --------------------------------------------------------------------------
  confirmReceipt: async (req, res) => {
    try {
      const {
        tokenId,
        token: rawToken,
        donationId,
        recipientId = 'user-recipient-1',
        recipientName = 'Grace Hope Children Shelter',
        receivedQuantity,
        foodCondition = 'EXCELLENT',
        discrepancyNotes,
      } = req.body;

      let tokenRecord = tokenId ? handoverStore.getAllForDonation(donationId || '')?.find(t => t.id === tokenId) : null;
      if (!tokenRecord && rawToken) {
        tokenRecord = handoverStore.findToken(rawToken);
      }

      if (!tokenRecord) {
        return res.status(404).json({
          success: false,
          message: 'Receipt token is required to confirm handover.',
        });
      }

      if (tokenRecord.stage !== 'RECEIPT') {
        return res.status(400).json({
          success: false,
          message: 'Token must be a RECEIPT stage token.',
        });
      }

      const donation = donationsStore.findById(tokenRecord.donationId);
      if (!donation) {
        return res.status(404).json({
          success: false,
          message: 'Donation not found.',
        });
      }

      if (donation.status === 'DELIVERED' || donation.status === 'COMPLETED') {
        return res.status(409).json({
          success: false,
          message: 'Donation has already been delivered. Duplicate confirmation prevented.',
        });
      }

      // ATOMIC TRANSACTION: Consume receipt token
      const consumedToken = handoverStore.consumeToken(tokenRecord.id, recipientId, 'recipient');
      const deliveredTimestamp = new Date().toISOString();

      // Update donation status to DELIVERED
      const updatedDonation = donationsStore.update(donation.id, {
        status: 'DELIVERED',
        deliveredAt: deliveredTimestamp,
        receivedQuantity: receivedQuantity || donation.matchedRecipients?.[0]?.claimedQuantity || donation.initialQuantity,
        foodCondition,
        recipientDiscrepancyNotes: discrepancyNotes || null,
        confirmedByRecipientId: recipientId,
        confirmedByRecipientName: recipientName,
      });

      // Update delivery task
      let task = deliveryTasksStore.findByDonationId(donation.id);
      if (task) {
        task = deliveryTasksStore.updateMilestone(task.id, 'DELIVERED', {
          deliveredAt: deliveredTimestamp,
          receivedQuantity,
          foodCondition,
          recipientNotes: discrepancyNotes || '',
        });
      }

      // Generate digital Handover Receipt with cryptographic hash
      const receiptHash = crypto
        .createHash('sha256')
        .update(`${donation.id}:${recipientId}:${deliveredTimestamp}:${consumedToken.id}`)
        .digest('hex');

      const handoverReceipt = {
        receiptNumber: `REC-${Date.now().toString(36).toUpperCase()}-${donation.id.toUpperCase()}`,
        donationId: donation.id,
        foodName: donation.foodName,
        donorName: donation.donorName,
        recipientName: recipientName || 'Grace Hope Children Shelter',
        deliveryAgentName: 'Vikram Singh (Rider #42)',
        quantityDelivered: `${receivedQuantity || 35} ${donation.unit || 'servings'}`,
        conditionReport: foodCondition,
        timestamp: deliveredTimestamp,
        cryptographicProof: receiptHash,
        tokenProofId: consumedToken.id,
      };

      auditStore.record({
        action: 'RECEIPT_CONFIRMED',
        donationId: donation.id,
        taskId: task?.id,
        stage: 'RECEIPT',
        userId: recipientId,
        userRole: 'recipient',
        ip: req.ip,
        success: true,
        reason: 'Recipient explicitly confirmed physical food delivery. Handover successfully completed.',
        metadata: handoverReceipt,
      });

      // Broadcast real-time status update to all connected dashboards
      broadcastHandoverEvent({
        type: 'RECEIPT_CONFIRMED',
        donationId: donation.id,
        taskId: task?.id,
        status: 'DELIVERED',
        deliveredTimestamp,
        handoverReceipt,
      });

      return res.status(200).json({
        success: true,
        message: 'Handover complete! Surplus food successfully delivered and rescued.',
        donation: updatedDonation,
        task,
        receipt: handoverReceipt,
      });
    } catch (err) {
      console.error('confirmReceipt error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to complete delivery handover.',
      });
    }
  },

  // --------------------------------------------------------------------------
  // STATUS & AUDIT TRAIL QUERY
  // --------------------------------------------------------------------------
  getStatus: async (req, res) => {
    try {
      const { donationId } = req.params;
      const donation = donationsStore.findById(donationId);

      if (!donation) {
        return res.status(404).json({
          success: false,
          message: 'Donation not found.',
        });
      }

      const task = deliveryTasksStore.findByDonationId(donationId);
      const tokens = handoverStore.getAllForDonation(donationId);
      const audit = auditStore.getAll({ donationId });

      return res.status(200).json({
        success: true,
        donation,
        task: task || null,
        tokens: tokens.map((t) => ({
          id: t.id,
          stage: t.stage,
          status: t.status,
          expiresAt: t.expiresAt,
          createdAt: t.createdAt,
          usedAt: t.usedAt,
        })),
        auditTrail: audit,
      });
    } catch (err) {
      console.error('getStatus error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to retrieve handover status.',
      });
    }
  },
};
