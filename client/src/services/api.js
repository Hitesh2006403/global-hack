// Unified API client: seamlessly toggles between local mock storage and live backend REST APIs
import {
  INITIAL_USERS,
  INITIAL_DONATIONS,
  INITIAL_RECIPIENT_REQUIREMENTS,
  INITIAL_DELIVERY_TASKS,
  INITIAL_IMPACT_METRICS,
  INITIAL_REVIEWS,
  INITIAL_VERIFIED_HANDOVERS,
  INITIAL_PARTNERS_DIRECTORY,
} from './mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Local storage keys for persisting mock state across browser refreshes
const STORAGE_KEYS = {
  USERS: 'sap_users_v1',
  DONATIONS: 'sap_donations_v1',
  REQUIREMENTS: 'sap_requirements_v1',
  TASKS: 'sap_tasks_v1',
  METRICS: 'sap_metrics_v1',
  CURRENT_USER: 'sap_current_user_v1',
  REVIEWS: 'sap_reviews_v1',
};

// State initializer
const loadOrInit = (key, initial) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (key === STORAGE_KEYS.DONATIONS && Array.isArray(parsed)) {
      const existingIds = new Set(parsed.map((d) => d.id));
      const enriched = parsed.map((d) => {
        if (!d.venueType) {
          const match = initial.find((init) => init.id === d.id);
          if (match?.venueType) return { ...d, venueType: match.venueType };
          const text = `${d.donorName || ''} ${d.foodName || ''}`.toLowerCase();
          if (/hotel|hyatt|sheraton/i.test(text)) return { ...d, venueType: 'HOTELS' };
          if (/restaurant|resturant|bistro|bakery/i.test(text)) return { ...d, venueType: 'Resturant' };
          if (/catering|event|venue|pavilion/i.test(text)) return { ...d, venueType: 'Event venue' };
          return { ...d, venueType: 'Others' };
        }
        return d;
      });
      for (const item of initial) {
        if (!existingIds.has(item.id)) enriched.push(item);
      }
      localStorage.setItem(key, JSON.stringify(enriched));
      return enriched;
    }
    return parsed;
  } catch {
    return initial;
  }
};

const save = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};

// Initialize in-memory / persisted mock store
let mockUsers = loadOrInit(STORAGE_KEYS.USERS, INITIAL_USERS);
let mockDonations = loadOrInit(STORAGE_KEYS.DONATIONS, INITIAL_DONATIONS);
let mockRequirements = loadOrInit(STORAGE_KEYS.REQUIREMENTS, INITIAL_RECIPIENT_REQUIREMENTS);
let mockTasks = loadOrInit(STORAGE_KEYS.TASKS, INITIAL_DELIVERY_TASKS);
let mockMetrics = loadOrInit(STORAGE_KEYS.METRICS, INITIAL_IMPACT_METRICS);
let mockReviews = loadOrInit(STORAGE_KEYS.REVIEWS, INITIAL_REVIEWS);

// Simulated network delay helper
const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  // ----------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------
  login: async (email, password) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || 'Invalid credentials');
      }
      const user = data.data?.user || data.user;
      const token = data.data?.token || data.token;
      if (token) {
        localStorage.setItem('sap_jwt_token', token);
      }
      if (user) {
        if (!user.id && user._id) user.id = user._id;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      }
      return { token, user };
    }

    await delay(150);
    const user = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('User not found. Use one-click member login or register.');
    }
    if (password && user.password && password !== user.password && password !== 'password123') {
      throw new Error('Incorrect password. Please use the member credentials provided on the card.');
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    return { token: 'mock-jwt-token-' + user.id, user };
  },

  // Genuine Google OAuth 2.0 Credential Verification on Backend
  loginWithGoogle: async (credential, role = 'donor', portalVerificationData = {}) => {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential, role, portalVerificationData }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || 'Google authentication rejected by server.');
      }
      const user = data.data?.user || data.user;
      const token = data.data?.token || data.token;
      if (token) {
        localStorage.setItem('sap_jwt_token', token);
      }
      if (user) {
        if (!user.id && user._id) user.id = user._id;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      }
      return { token, user };
    } catch (err) {
      throw err;
    }
  },

  getMe: async () => {
    try {
      const token = localStorage.getItem('sap_jwt_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      const user = data.data?.user || data.user;
      if (user) {
        if (!user.id && user._id) user.id = user._id;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        return user;
      }
      return null;
    } catch {
      return null;
    }
  },

  logoutSession: async () => {
    try {
      const token = localStorage.getItem('sap_jwt_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    localStorage.removeItem('sap_jwt_token');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  register: async (userData) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || 'Registration failed');
      }
      const user = data.data?.user || data.user;
      const token = data.data?.token || data.token;
      if (token) {
        localStorage.setItem('sap_jwt_token', token);
      }
      if (user) {
        if (!user.id && user._id) user.id = user._id;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      }
      return { token, user };
    }

    await delay();
    const newUser = {
      id: 'user-' + Date.now(),
      ...userData,
      rating: 5.0,
      totalDonations: 0,
      verified: true,
    };
    mockUsers.push(newUser);
    save(STORAGE_KEYS.USERS, mockUsers);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
    return { token: 'mock-jwt-token-' + newUser.id, user: newUser };
  },

  getCurrentUser: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    // Default to Donor for instant preview
    const defaultUser = mockUsers[0];
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultUser));
    return defaultUser;
  },

  switchUser: (userId) => {
    const user = mockUsers.find((u) => u.id === userId);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }
    return user;
  },

  getAllUsers: () => mockUsers,

  // ----------------------------------------------------
  // DONATIONS (Donor Journey)
  // ----------------------------------------------------
  getDonations: async (filter = {}) => {
    if (!USE_MOCK) {
      try {
        const token = localStorage.getItem('sap_jwt_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const query = new URLSearchParams(filter).toString();
        const res = await fetch(`${API_BASE}/donations${query ? `?${query}` : ''}`, {
          headers,
          credentials: 'include',
        });
        const json = await res.json();
        if (res.ok) {
          const list = Array.isArray(json) ? json : (json.data || []);
          return list.map((d) => ({
            ...d,
            id: d.id || d._id,
            totalQuantity: d.totalQuantity || d.initialQuantity || 10,
            remainingQuantity: d.remainingQuantity !== undefined ? d.remainingQuantity : (d.totalQuantity || d.initialQuantity || 10),
            venueType: d.areaLabel || d.venueType || 'Others',
            donorName: d.donorId?.name || d.donorName || 'Verified Donor Kitchen',
            donorPhone: d.donorId?.phone || d.donorPhone || '+91 98765 43210',
            pickupLocation: d.address
              ? {
                  address: d.address.formattedAddress || d.address.street || d.address.city,
                  coordinates: d.location?.coordinates || [77.62, 12.97],
                }
              : d.pickupLocation,
          }));
        }
      } catch (e) {
        console.warn('Live donations fetch error, using local fallback:', e);
      }
    }
    await delay(150);
    let list = [...mockDonations];
    if (filter.donorId) {
      list = list.filter((d) => d.donorId === filter.donorId);
    }
    if (filter.status && filter.status !== 'ALL') {
      list = list.filter((d) => d.status === filter.status);
    }
    return list;
  },

  createDonation: async (donationData) => {
    if (!USE_MOCK) {
      try {
        const token = localStorage.getItem('sap_jwt_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const now = new Date();
        const cookedAt = donationData.cookedTime ? new Date(donationData.cookedTime) : new Date(now.getTime() - 30 * 60 * 1000);
        const expiryAt = donationData.expiryDeadline ? new Date(donationData.expiryDeadline) : new Date(now.getTime() + 4 * 60 * 60 * 1000);
        const safetyBufferMinutes = Number(donationData.safetyBufferMinutes) || 60;
        const pickupWindowStart = new Date(now.getTime() + 5 * 60 * 1000);
        const effectiveExpiry = new Date(expiryAt.getTime() - safetyBufferMinutes * 60 * 1000);
        const pickupWindowEnd = new Date(Math.min(now.getTime() + 2 * 60 * 60 * 1000, effectiveExpiry.getTime() - 5 * 60 * 1000));

        const rawFoodType = (donationData.foodType || 'cooked_meals').toLowerCase();
        const foodType = ['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items'].includes(rawFoodType)
          ? rawFoodType
          : 'cooked_meals';

        const rawDiet = (donationData.dietaryCategory || donationData.dietaryType || 'vegetarian').toLowerCase();
        const dietaryType = ['vegetarian', 'non_vegetarian', 'vegan'].includes(rawDiet)
          ? rawDiet
          : 'vegetarian';

        const rawUnit = (donationData.unit || 'plates').toLowerCase();
        const unit = ['plates', 'kg', 'packets', 'servings'].includes(rawUnit)
          ? rawUnit
          : 'plates';

        const coords = donationData.pickupLocation?.coordinates || [77.62, 12.97];
        const formattedAddress = donationData.pickupLocation?.address || 'Indiranagar, Bengaluru';

        const payload = {
          foodName: donationData.foodName,
          foodType,
          dietaryType,
          totalQuantity: Math.round(Number(donationData.initialQuantity || donationData.totalQuantity || 10)),
          unit,
          cookedAt,
          expiryAt,
          safetyBufferMinutes,
          pickupWindowStart,
          pickupWindowEnd,
          packagingType: 'sealed_containers',
          instructions: donationData.storageCondition || donationData.instructions || 'Keep refrigerated until collection',
          location: {
            type: 'Point',
            coordinates: coords,
          },
          address: {
            city: 'Bengaluru',
            formattedAddress,
          },
          areaLabel: donationData.venueType || 'Local Area',
        };

        const res = await fetch(`${API_BASE}/donations`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (res.ok) {
          const created = json.data || json;
          return { ...created, id: created.id || created._id };
        }
      } catch (err) {
        console.warn('Backend createDonation error, saving locally:', err);
      }
    }
    await delay(300);
    const newDonation = {
      id: 'don-' + Math.floor(100 + Math.random() * 900),
      createdAt: new Date().toISOString(),
      status: 'AVAILABLE',
      remainingQuantity: Number(donationData.initialQuantity),
      handoverQrToken: 'SAP-QR-' + Date.now().toString(36).toUpperCase(),
      matchedRecipients: [],
      ...donationData,
    };
    mockDonations.unshift(newDonation);
    save(STORAGE_KEYS.DONATIONS, mockDonations);

    // Update impact counters
    mockMetrics.activeDonationsCount += 1;
    save(STORAGE_KEYS.METRICS, mockMetrics);

    return newDonation;
  },

  reopenDonation: async (donationId, notes = '') => {
    if (!USE_MOCK) {
      try {
        const token = localStorage.getItem('sap_jwt_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/donations/${donationId}/reopen`, {
          method: 'PATCH',
          headers,
          credentials: 'include',
          body: JSON.stringify({ notes }),
        });
        const json = await res.json();
        if (res.ok) {
          const don = json.data || json;
          return { ...don, id: don.id || don._id };
        }
      } catch (e) {
        console.warn('Backend reopenDonation error:', e);
      }
    }
    await delay(200);
    const don = mockDonations.find((d) => d.id === donationId);
    if (!don) throw new Error('Donation not found');

    don.status = 'REOPENED';
    don.canReopen = false;
    don.reopenedAt = new Date().toISOString();
    don.reopenNotes = notes || 'Reopened and offered to nearby community shelters';
    save(STORAGE_KEYS.DONATIONS, mockDonations);
    return don;
  },

  // ----------------------------------------------------
  // RECIPIENT JOURNEY & PARTIAL ACCEPTANCE
  // ----------------------------------------------------
  getRequirements: async () => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/recipient/requirements`);
      return await res.json();
    }
    await delay(100);
    return mockRequirements;
  },

  postRequirement: async (reqData) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/recipient/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData),
      });
      return await res.json();
    }
    await delay(250);
    const newReq = {
      id: 'req-' + Math.floor(200 + Math.random() * 800),
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
      ...reqData,
    };
    mockRequirements.unshift(newReq);
    save(STORAGE_KEYS.REQUIREMENTS, mockRequirements);
    return newReq;
  },

  getSmartMatches: async (recipientId) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/recipient/matches?recipientId=${recipientId}`);
      return await res.json();
    }
    await delay(200);
    // Find active donations that have remaining food
    const eligible = mockDonations.filter(
      (d) => (d.status === 'AVAILABLE' || d.status === 'PARTIALLY_ACCEPTED' || d.status === 'REOPENED') && d.remainingQuantity > 0
    );

    // Calculate smart match scores with reasoning tags
    return eligible.map((don, idx) => {
      const expiryMs = new Date(don.expiryDeadline).getTime() - Date.now();
      const hoursLeft = Math.max(0.5, expiryMs / (1000 * 60 * 60));
      
      let baseScore = 95 - idx * 3;
      if (hoursLeft < 2) baseScore += 4; // Urgency boost
      const score = Math.min(99, Math.max(78, Math.round(baseScore)));

      const reasons = [
        `Within ${ (1.1 + idx * 0.7).toFixed(1) } km radius`,
        hoursLeft < 2 ? 'High Urgency: Ready for immediate collection' : 'Verified hygiene packaging',
        `${don.remainingQuantity} ${don.unit} surplus available`,
      ];

      return {
        donation: don,
        matchScore: score,
        distanceKm: (1.1 + idx * 0.7).toFixed(1),
        reasons,
      };
    });
  },

  acceptDonation: async ({ donationId, recipientId, recipientName, quantityAccepted, notes }) => {
    if (!USE_MOCK) {
      try {
        const token = localStorage.getItem('sap_jwt_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/donations/${donationId}/accept`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            recipientId,
            quantityAccepted: Number(quantityAccepted),
            notes,
          }),
        });
        const json = await res.json();
        if (res.ok) {
          const updatedDonation = json.data || json;
          const donNorm = { ...updatedDonation, id: updatedDonation.id || updatedDonation._id };
          const task = {
            id: 'task-' + Math.floor(400 + Math.random() * 600),
            donationId: donNorm.id,
            deliveryAgentId: 'agent@delivery.com',
            foodName: donNorm.foodName,
            quantity: `${quantityAccepted} ${donNorm.unit || 'plates'}`,
            foodType: donNorm.foodType,
            currentMilestone: 'ASSIGNED',
            pickup: {
              location: donNorm.address?.formattedAddress || 'Donor Location',
              donorName: donNorm.donorId?.name || donNorm.donorName || 'Donor Kitchen',
              donorPhone: donNorm.donorId?.phone || '+91 98765 43210',
            },
            dropoff: {
              location: 'Recipient Shelter Location',
              recipientName: recipientName || 'Recipient Partner',
              recipientPhone: '+91 91234 56789',
            },
          };
          return { donation: donNorm, task };
        }
      } catch (e) {
        console.warn('Backend claim error, using local fallback:', e);
      }
    }
    await delay(300);
    const don = mockDonations.find((d) => d.id === donationId);
    if (!don) throw new Error('Donation not found');

    const qty = Number(quantityAccepted);
    if (qty <= 0 || qty > don.remainingQuantity) {
      throw new Error(`Invalid quantity. Must be between 1 and ${don.remainingQuantity}`);
    }

    don.remainingQuantity -= qty;
    if (don.remainingQuantity === 0) {
      don.status = 'ACCEPTED';
    } else {
      don.status = 'PARTIALLY_ACCEPTED';
    }

    if (!don.matchedRecipients) don.matchedRecipients = [];
    don.matchedRecipients.push({
      recipientId,
      recipientName,
      claimedQuantity: qty,
      claimedAt: new Date().toISOString(),
      notes,
    });

    // Create a new delivery task automatically
    const newTask = {
      id: 'task-' + Math.floor(400 + Math.random() * 600),
      donationId: don.id,
      deliveryAgentId: 'user-delivery-1',
      foodName: don.foodName,
      quantity: `${qty} ${don.unit}`,
      foodType: don.foodType,
      storageCondition: don.storageCondition,
      urgencyLevel: 'HIGH',
      pickup: {
        location: don.pickupLocation?.address || 'Donor Location',
        donorName: don.donorName,
        donorPhone: don.donorPhone || '+91 98765 43210',
        deadline: don.expiryDeadline,
      },
      dropoff: {
        location: 'Recipient Shelter Location',
        recipientName: recipientName,
        recipientPhone: '+91 91234 56789',
        deadline: don.expiryDeadline,
      },
      currentMilestone: 'ASSIGNED',
      distanceTotalKm: 3.4,
      estimatedMinutes: 20,
      qrRequiredToken: don.handoverQrToken,
      safetyChecklistCompleted: false,
      verifiedAt: null,
    };

    mockTasks.unshift(newTask);
    save(STORAGE_KEYS.TASKS, mockTasks);
    save(STORAGE_KEYS.DONATIONS, mockDonations);

    return { donation: don, task: newTask };
  },

  // ----------------------------------------------------
  // DELIVERY AGENT JOURNEY & QR VERIFICATION
  // ----------------------------------------------------
  getDeliveryTasks: async (deliveryAgentId) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/delivery/tasks?agentId=${deliveryAgentId}`);
      return await res.json();
    }
    await delay(150);
    return mockTasks;
  },

  updateDeliveryMilestone: async (taskId, nextMilestone) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/delivery/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextMilestone }),
      });
      return await res.json();
    }
    await delay(200);
    const task = mockTasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found');

    task.currentMilestone = nextMilestone;
    save(STORAGE_KEYS.TASKS, mockTasks);
    return task;
  },

  // ----------------------------------------------------
  // SECURE QR HANDOVER WORKFLOW (STAGES 1, 2, 3)
  // ----------------------------------------------------
  // Stage 1: Donor retrieves or generates dynamic secure Pickup QR code
  getPickupToken: async (donationId) => {
    try {
      const res = await fetch(`${API_BASE}/handover/donations/${donationId}/pickup-token`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch pickup QR code');
      return data;
    } catch (err) {
      // Local fallback
      const don = mockDonations.find((d) => d.id === donationId);
      return {
        success: true,
        token: {
          id: `tok-pk-${donationId}`,
          donationId,
          stage: 'PICKUP',
          rawToken: don?.handoverQrToken || `SAP-PK-${donationId.toUpperCase()}-SECURE`,
          tokenHash: 'sha256-mock-hash',
          expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          status: 'ACTIVE',
        },
        donation: don || null,
      };
    }
  },

  // Stage 2: Delivery Agent scans donor's pickup QR code (Validation Step)
  verifyPickupScan: async ({ token, taskId, donationId, agentId }) => {
    try {
      const res = await fetch(`${API_BASE}/handover/verify-pickup-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, taskId, donationId, agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Pickup QR validation failed.');
      return data;
    } catch (err) {
      if (USE_MOCK) {
        await delay(200);
        const task = mockTasks.find((t) => t.id === taskId || t.qrRequiredToken === token);
        if (!task && !token?.includes('SAP')) throw new Error('Invalid QR code.');
        return {
          success: true,
          message: 'QR verified! Complete physical inspection.',
          task: task || mockTasks[0],
          donation: mockDonations.find((d) => d.id === task?.donationId) || mockDonations[0],
        };
      }
      throw err;
    }
  },

  // Stage 2: Delivery Agent confirms physical pickup after checklist
  confirmPickup: async ({ tokenId, token, taskId, safetyChecklist, agentId, notes }) => {
    try {
      const res = await fetch(`${API_BASE}/handover/confirm-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tokenId, token, taskId, safetyChecklist, agentId, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Pickup confirmation failed.');
      return data;
    } catch (err) {
      if (USE_MOCK) {
        await delay(300);
        const task = mockTasks.find((t) => t.id === taskId);
        if (task) task.currentMilestone = 'PICKED_UP';
        const don = mockDonations.find((d) => d.id === task?.donationId);
        if (don) don.status = 'PICKED_UP';
        save(STORAGE_KEYS.TASKS, mockTasks);
        save(STORAGE_KEYS.DONATIONS, mockDonations);
        return {
          success: true,
          task,
          donation: don,
          receiptToken: {
            id: `tok-rc-${task?.id}`,
            stage: 'RECEIPT',
            rawToken: `SAP-RC-${task?.donationId?.toUpperCase() || 'DON'}-VERIFIED`,
            expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            status: 'ACTIVE',
          },
        };
      }
      throw err;
    }
  },

  // Stage 2 / 3: Delivery Agent retrieves receipt token to present to recipient
  getReceiptToken: async (donationId) => {
    try {
      const res = await fetch(`${API_BASE}/handover/donations/${donationId}/receipt-token`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch receipt token');
      return data;
    } catch (err) {
      return {
        success: true,
        token: {
          id: `tok-rc-${donationId}`,
          donationId,
          stage: 'RECEIPT',
          rawToken: `SAP-RC-${donationId.toUpperCase()}-SECURE`,
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          status: 'ACTIVE',
        },
      };
    }
  },

  // Stage 3: Recipient scans delivery agent's receipt QR code (Validation Step)
  verifyReceiptScan: async ({ token, recipientId }) => {
    try {
      const res = await fetch(`${API_BASE}/handover/verify-receipt-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, recipientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Receipt QR validation failed.');
      return data;
    } catch (err) {
      if (USE_MOCK) {
        await delay(200);
        return {
          success: true,
          message: 'Receipt QR verified! Confirm food condition.',
          donation: mockDonations[0],
          task: mockTasks[0],
        };
      }
      throw err;
    }
  },

  // Stage 3: Recipient confirms actual food delivery and condition
  confirmReceipt: async ({
    tokenId,
    token,
    donationId,
    recipientId,
    recipientName,
    receivedQuantity,
    foodCondition,
    discrepancyNotes,
  }) => {
    try {
      const res = await fetch(`${API_BASE}/handover/confirm-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tokenId,
          token,
          donationId,
          recipientId,
          recipientName,
          receivedQuantity,
          foodCondition,
          discrepancyNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Receipt confirmation failed.');
      return data;
    } catch (err) {
      if (USE_MOCK) {
        await delay(300);
        const don = mockDonations.find((d) => d.id === donationId);
        if (don) don.status = 'DELIVERED';
        const task = mockTasks.find((t) => t.donationId === donationId);
        if (task) task.currentMilestone = 'DELIVERED';
        save(STORAGE_KEYS.DONATIONS, mockDonations);
        save(STORAGE_KEYS.TASKS, mockTasks);
        return {
          success: true,
          donation: don,
          task,
          receipt: {
            receiptNumber: `REC-MOCK-${donationId}`,
            donationId,
            timestamp: new Date().toISOString(),
          },
        };
      }
      throw err;
    }
  },

  // Query handover status & audit trail
  getHandoverStatus: async (donationId) => {
    try {
      const res = await fetch(`${API_BASE}/handover/status/${donationId}`, {
        credentials: 'include',
      });
      return await res.json();
    } catch (err) {
      return null;
    }
  },

  // Server-Sent Events stream subscription
  subscribeHandoverStream: (onEvent, onError) => {
    try {
      const eventSource = new EventSource(`${API_BASE}/handover/stream`, {
        withCredentials: true,
      });

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onEvent(parsed);
        } catch (e) {
          console.error('Error parsing SSE event:', e);
        }
      };

      eventSource.onerror = (err) => {
        if (onError) onError(err);
      };

      return () => {
        eventSource.close();
      };
    } catch (e) {
      console.warn('SSE not supported or failed to initialize:', e);
      return () => {};
    }
  },

  // Legacy compatibility wrapper
  verifyHandoverQr: async ({ taskId, qrToken, safetyChecklist }) => {
    return api.confirmPickup({
      token: qrToken,
      taskId,
      safetyChecklist,
      agentId: 'user-delivery-1',
    });
  },

  // ----------------------------------------------------
  // ADMIN DASHBOARD & METRICS
  // ----------------------------------------------------
  getImpactMetrics: async () => {
    if (!USE_MOCK) {
      try {
        const res = await fetch(`${API_BASE}/dashboard/impact`);
        const json = await res.json();
        if (res.ok && json.data) {
          return {
            ...mockMetrics,
            mealsDonatedTotal: json.data.mealsSaved || mockMetrics.mealsDonatedTotal,
            activeDonationsCount: json.data.activeSurplusListings || mockMetrics.activeDonationsCount,
            rescuedPercent: json.data.completionRate || mockMetrics.rescuedPercent,
          };
        }
      } catch (e) {
        console.warn('Live impact fetch fallback:', e);
      }
    }
    await delay(100);
    return mockMetrics;
  },

  // ----------------------------------------------------
  // REVIEWS & COMMUNITY FEEDBACK
  // ----------------------------------------------------
  getReviews: async () => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/reviews`);
      return await res.json();
    }
    await delay(100);
    return mockReviews;
  },

  submitReview: async (reviewData) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData),
      });
      return await res.json();
    }
    await delay(250);
    const newReview = {
      id: 'rev-' + Date.now(),
      createdAt: new Date().toISOString(),
      verifiedRescue: true,
      ...reviewData,
    };
    mockReviews.unshift(newReview);
    save(STORAGE_KEYS.REVIEWS, mockReviews);
    return newReview;
  },

  // ----------------------------------------------------
  // VERIFIED USAGE & PARTNER DIRECTORY TELEMETRY
  // ----------------------------------------------------
  getVerifiedHandovers: async () => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/admin/verified-handovers`);
      return await res.json();
    }
    await delay(100);
    return INITIAL_VERIFIED_HANDOVERS;
  },

  getPartnersDirectory: async () => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/admin/partners`);
      return await res.json();
    }
    await delay(100);
    return INITIAL_PARTNERS_DIRECTORY;
  },

  resetDemoData: () => {
    mockUsers = INITIAL_USERS;
    mockDonations = INITIAL_DONATIONS;
    mockRequirements = INITIAL_RECIPIENT_REQUIREMENTS;
    mockTasks = INITIAL_DELIVERY_TASKS;
    mockMetrics = INITIAL_IMPACT_METRICS;
    mockReviews = INITIAL_REVIEWS;
    save(STORAGE_KEYS.USERS, INITIAL_USERS);
    save(STORAGE_KEYS.DONATIONS, INITIAL_DONATIONS);
    save(STORAGE_KEYS.REQUIREMENTS, INITIAL_RECIPIENT_REQUIREMENTS);
    save(STORAGE_KEYS.TASKS, INITIAL_DELIVERY_TASKS);
    save(STORAGE_KEYS.METRICS, INITIAL_IMPACT_METRICS);
    save(STORAGE_KEYS.REVIEWS, INITIAL_REVIEWS);
    return true;
  },
};

