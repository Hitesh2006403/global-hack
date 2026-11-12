import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'handovers.json');

const HMAC_SECRET = process.env.HANDOVER_SECRET || 'share-a-plate-handover-cryptographic-signing-secret-2026';

// Helper to generate cryptographically unpredictable token
const generateSecureToken = (prefix = 'SAP-PK') => {
  const randomSegment = crypto.randomBytes(18).toString('base64url').replace(/[-_]/g, 'X').toUpperCase();
  return `${prefix}-${randomSegment.slice(0, 16)}`;
};

// Compute SHA-256 hash of token
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
};

// Compute HMAC-SHA256 signature
const signToken = (token, donationId, stage) => {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`${donationId}:${stage}:${token}`)
    .digest('hex');
};

// Seed with authentic initial tokens for don-101 (Chef Marco -> Vikram Singh -> Sister Teresa)
const SEED_HANDOVERS = [
  {
    id: 'tok-pk-seed-101',
    donationId: 'don-101',
    taskId: 'task-302',
    stage: 'PICKUP',
    rawToken: 'SAP-PK-DON-101-SECURE-9921',
    tokenHash: hashToken('SAP-PK-DON-101-SECURE-9921'),
    signature: signToken('SAP-PK-DON-101-SECURE-9921', 'don-101', 'PICKUP'),
    donorId: 'user-donor-1',
    assignedAgentId: 'user-delivery-1',
    recipientId: 'user-recipient-1',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    status: 'ACTIVE',
    usedAt: null,
    usedByUserId: null,
  },
  {
    id: 'tok-pk-seed-103',
    donationId: 'don-103',
    taskId: 'task-301',
    stage: 'PICKUP',
    rawToken: 'SAP-PK-DON-103-SECURE-8831',
    tokenHash: hashToken('SAP-PK-DON-103-SECURE-8831'),
    signature: signToken('SAP-PK-DON-103-SECURE-8831', 'don-103', 'PICKUP'),
    donorId: 'user-donor-3',
    assignedAgentId: 'user-delivery-1',
    recipientId: 'user-recipient-1',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    status: 'ACTIVE',
    usedAt: null,
    usedByUserId: null,
  },
];

let handovers = [];

const loadHandovers = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      handovers = JSON.parse(data);
    } else {
      handovers = [...SEED_HANDOVERS];
      saveHandovers();
    }
  } catch (err) {
    console.error('Error loading handovers store:', err);
    handovers = [...SEED_HANDOVERS];
  }
};

const saveHandovers = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(handovers, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving handovers store:', err);
  }
};

loadHandovers();

export const handoverStore = {
  // Generate a cryptographically signed PICKUP token
  createPickupToken: ({ donationId, taskId, donorId, assignedAgentId, recipientId, expiryHours = 3 }) => {
    // Revoke any existing active pickup token for this donation
    handovers.forEach((t) => {
      if (t.donationId === donationId && t.stage === 'PICKUP' && t.status === 'ACTIVE') {
        t.status = 'REVOKED';
        t.revokedAt = new Date().toISOString();
        t.revocationReason = 'Superceded by new pickup token generation';
      }
    });

    const rawToken = generateSecureToken(`SAP-PK-${donationId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`);
    const tokenHash = hashToken(rawToken);
    const signature = signToken(rawToken, donationId, 'PICKUP');

    const tokenRecord = {
      id: `tok-pk-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      donationId,
      taskId: taskId || null,
      stage: 'PICKUP',
      rawToken,
      tokenHash,
      signature,
      donorId,
      assignedAgentId: assignedAgentId || null,
      recipientId: recipientId || null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString(),
      status: 'ACTIVE',
      usedAt: null,
      usedByUserId: null,
    };

    handovers.unshift(tokenRecord);
    saveHandovers();
    return tokenRecord;
  },

  // Generate a cryptographically signed RECEIPT token (Stage 2)
  createReceiptToken: ({ donationId, taskId, donorId, assignedAgentId, recipientId, expiryHours = 4 }) => {
    // Revoke any existing active receipt token for this donation
    handovers.forEach((t) => {
      if (t.donationId === donationId && t.stage === 'RECEIPT' && t.status === 'ACTIVE') {
        t.status = 'REVOKED';
        t.revokedAt = new Date().toISOString();
      }
    });

    const rawToken = generateSecureToken(`SAP-RC-${donationId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`);
    const tokenHash = hashToken(rawToken);
    const signature = signToken(rawToken, donationId, 'RECEIPT');

    const tokenRecord = {
      id: `tok-rc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      donationId,
      taskId: taskId || null,
      stage: 'RECEIPT',
      rawToken,
      tokenHash,
      signature,
      donorId,
      assignedAgentId,
      recipientId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString(),
      status: 'ACTIVE',
      usedAt: null,
      usedByUserId: null,
    };

    handovers.unshift(tokenRecord);
    saveHandovers();
    return tokenRecord;
  },

  // Lookup token by raw input or hash
  findToken: (inputToken) => {
    if (!inputToken) return null;
    const clean = inputToken.trim();
    const hash = hashToken(clean);
    return handovers.find((t) => t.rawToken === clean || t.tokenHash === hash);
  },

  // Get active token for a donation and stage
  getActiveToken: (donationId, stage) => {
    const now = new Date();
    return handovers.find((t) => {
      if (t.donationId !== donationId) return false;
      if (t.stage !== stage) return false;
      if (t.status !== 'ACTIVE') return false;
      if (new Date(t.expiresAt) <= now) {
        t.status = 'EXPIRED';
        saveHandovers();
        return false;
      }
      return true;
    });
  },

  // Atomically consume a token
  consumeToken: (tokenId, userId, userRole) => {
    const tokenRecord = handovers.find((t) => t.id === tokenId);
    if (!tokenRecord) {
      throw new Error('Token record not found.');
    }

    if (tokenRecord.status === 'USED') {
      throw new Error('Token has already been consumed and cannot be reused.');
    }

    if (tokenRecord.status === 'REVOKED') {
      throw new Error('Token has been revoked.');
    }

    if (new Date(tokenRecord.expiresAt) <= new Date()) {
      tokenRecord.status = 'EXPIRED';
      saveHandovers();
      throw new Error('Handover token has expired. Please request a new QR code.');
    }

    if (tokenRecord.status !== 'ACTIVE') {
      throw new Error(`Token is inactive (${tokenRecord.status}).`);
    }

    // Atomic conditional consume
    tokenRecord.status = 'USED';
    tokenRecord.usedAt = new Date().toISOString();
    tokenRecord.usedByUserId = userId;
    tokenRecord.usedByRole = userRole;

    saveHandovers();
    return tokenRecord;
  },

  revokeToken: (tokenId, reason = 'Manually revoked') => {
    const tokenRecord = handovers.find((t) => t.id === tokenId);
    if (tokenRecord) {
      tokenRecord.status = 'REVOKED';
      tokenRecord.revokedAt = new Date().toISOString();
      tokenRecord.revocationReason = reason;
      saveHandovers();
    }
    return tokenRecord;
  },

  getAllForDonation: (donationId) => {
    return handovers.filter((t) => t.donationId === donationId);
  },

  reset: () => {
    handovers = [...SEED_HANDOVERS];
    saveHandovers();
    return handovers;
  },
};
