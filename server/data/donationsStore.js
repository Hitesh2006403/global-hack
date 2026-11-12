import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'donations.json');

const getFutureISO = (hoursFromNow) => {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
};
const getPastISO = (hoursAgo) => {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
};

const SEED_DONATIONS = [
  {
    id: 'don-101',
    donorId: 'user-donor-1',
    donorName: 'Grand Hyatt Banquet & Bistro',
    venueType: 'HOTELS',
    donorPhone: '+91 98765 43210',
    foodName: 'Executive Buffet: Steamed Basmati Rice & Paneer Butter Masala',
    foodType: 'cooked_meals',
    initialQuantity: 80,
    remainingQuantity: 45,
    unit: 'servings',
    dietaryCategory: 'veg',
    storageCondition: 'heated',
    cookedTime: getPastISO(1.5),
    expiryDeadline: getFutureISO(2.5),
    safetyBufferMinutes: 45,
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    pickupLocation: {
      address: 'Gate 3, Hyatt Regency Service Bay, MG Road',
      landmark: 'Opposite Metro Pillar 140',
      coordinates: [77.6191, 12.9716],
    },
    pickupAvailability: 'Immediate pickup preferred before 10:30 PM',
    foodSafetyDeclaration: {
      hygienicallyPrepared: true,
      temperatureMaintained: true,
      sealedPackaging: true,
      allergenNotes: 'Contains dairy (paneer, butter). Nut-free.',
    },
    status: 'READY_FOR_PICKUP',
    assignedDeliveryAgentId: 'user-delivery-1',
    deliveryAgentName: 'Vikram Singh (Rider #42)',
    matchedRecipients: [
      {
        recipientId: 'user-recipient-1',
        recipientName: 'Grace Hope Children Shelter',
        matchScore: 96,
        distanceKm: 1.4,
        reasons: ['Within 1.5 km', 'Accepts Veg Hot Meals', 'Urgent need match'],
        claimedQuantity: 35,
        claimedAt: getPastISO(0.4),
      },
    ],
    createdAt: getPastISO(1.8),
  },
  {
    id: 'don-102',
    donorId: 'user-donor-1',
    donorName: 'Artisan Sourdough & Bakery Guild',
    venueType: 'Resturant',
    donorPhone: '+91 98765 99887',
    foodName: 'Fresh Baked Multigrain Loaves, Brioche & Croissants',
    foodType: 'bakery',
    initialQuantity: 50,
    remainingQuantity: 50,
    unit: 'packets',
    dietaryCategory: 'veg',
    storageCondition: 'room_temp',
    cookedTime: getPastISO(3),
    expiryDeadline: getFutureISO(1.2),
    safetyBufferMinutes: 30,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    pickupLocation: {
      address: 'Shop 12, Indiranagar 100ft Road',
      landmark: 'Next to Blue Tokai Coffee',
      coordinates: [77.6408, 12.9784],
    },
    pickupAvailability: 'Ready right now. Contact manager on arrival.',
    foodSafetyDeclaration: {
      hygienicallyPrepared: true,
      temperatureMaintained: true,
      sealedPackaging: true,
      allergenNotes: 'Contains wheat gluten. May contain sesame.',
    },
    status: 'AVAILABLE',
    matchedRecipients: [],
    createdAt: getPastISO(0.8),
  },
  {
    id: 'don-103',
    donorId: 'user-donor-3',
    donorName: 'Infosys Food Court 4',
    venueType: 'Others',
    donorPhone: '+91 97711 22334',
    foodName: 'Nutritious South Indian Meal: Sambar, Rice, Poriyal & Curd',
    foodType: 'cooked_meals',
    initialQuantity: 120,
    remainingQuantity: 0,
    unit: 'servings',
    dietaryCategory: 'veg',
    storageCondition: 'heated',
    cookedTime: getPastISO(4),
    expiryDeadline: getFutureISO(4),
    safetyBufferMinutes: 60,
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80',
    pickupLocation: {
      address: 'Electronic City Phase 1, Campus Food Court Loading Dock',
      landmark: 'Dock B',
      coordinates: [77.6833, 12.8452],
    },
    pickupAvailability: 'Pickup slot between 3:00 PM - 4:00 PM',
    foodSafetyDeclaration: {
      hygienicallyPrepared: true,
      temperatureMaintained: true,
      sealedPackaging: true,
      allergenNotes: 'Dairy curd packaged separately. Vegetarian.',
    },
    status: 'ASSIGNED',
    assignedDeliveryAgentId: 'user-delivery-1',
    deliveryAgentName: 'Vikram Singh (Rider #42)',
    currentRecipientId: 'user-recipient-1',
    recipientName: 'Grace Hope Children Shelter',
    matchedRecipients: [
      {
        recipientId: 'user-recipient-1',
        recipientName: 'Grace Hope Children Shelter',
        claimedQuantity: 120,
        claimedAt: getPastISO(1),
      },
    ],
    createdAt: getPastISO(3.2),
  },
  {
    id: 'don-106',
    donorId: 'user-donor-1',
    donorName: 'Sheraton Grand Luxury Hotel',
    venueType: 'HOTELS',
    donorPhone: '+91 98765 11223',
    foodName: 'Continental Breakfast Pastries & Fresh Juice Dispenser Trays',
    foodType: 'bakery',
    initialQuantity: 70,
    remainingQuantity: 70,
    unit: 'servings',
    dietaryCategory: 'veg',
    storageCondition: 'room_temp',
    cookedTime: getPastISO(2),
    expiryDeadline: getFutureISO(3.5),
    safetyBufferMinutes: 40,
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    pickupLocation: {
      address: 'Sheraton Grand, Rajajinagar Brigade Gateway',
      coordinates: [77.5546, 13.0112],
    },
    status: 'AVAILABLE',
    matchedRecipients: [],
    createdAt: getPastISO(1.2),
  },
  {
    id: 'don-107',
    donorId: 'user-donor-2',
    donorName: 'Punjab Grill Express Restaurant',
    venueType: 'Resturant',
    donorPhone: '+91 98765 33445',
    foodName: 'Homestyle Dal Tadka, Jeera Basmati Rice & Butter Roti Thalis',
    foodType: 'cooked_meals',
    initialQuantity: 90,
    remainingQuantity: 90,
    unit: 'servings',
    dietaryCategory: 'veg',
    storageCondition: 'heated',
    cookedTime: getPastISO(1),
    expiryDeadline: getFutureISO(2.8),
    safetyBufferMinutes: 45,
    imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80',
    pickupLocation: {
      address: '100 Feet Road, HAL 2nd Stage, Indiranagar',
      coordinates: [77.6412, 12.9719],
    },
    status: 'AVAILABLE',
    matchedRecipients: [],
    createdAt: getPastISO(0.6),
  },
  {
    id: 'don-108',
    donorId: 'user-donor-4',
    donorName: 'Palace Grounds Royal Wedding Pavilion',
    venueType: 'Event venue',
    donorPhone: '+91 98765 77889',
    foodName: 'Royal Reception Buffet: Paneer Lababdar, Pulao & Gulab Jamun',
    foodType: 'cooked_meals',
    initialQuantity: 180,
    remainingQuantity: 180,
    unit: 'servings',
    dietaryCategory: 'veg',
    storageCondition: 'heated',
    cookedTime: getPastISO(2),
    expiryDeadline: getFutureISO(4),
    safetyBufferMinutes: 60,
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    pickupLocation: {
      address: 'Gate 5, Palace Grounds, Bellary Road',
      coordinates: [77.5912, 13.0034],
    },
    status: 'AVAILABLE',
    matchedRecipients: [],
    createdAt: getPastISO(1.5),
  },
];

let donations = [];

const loadDonations = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      donations = JSON.parse(data);
    } else {
      donations = [...SEED_DONATIONS];
      saveDonations();
    }
  } catch (err) {
    console.error('Error loading donations store:', err);
    donations = [...SEED_DONATIONS];
  }
};

const saveDonations = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(donations, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving donations store:', err);
  }
};

loadDonations();

export const donationsStore = {
  getAll: (filter = {}) => {
    let list = [...donations];
    if (filter.donorId) list = list.filter((d) => d.donorId === filter.donorId);
    if (filter.status && filter.status !== 'ALL') list = list.filter((d) => d.status === filter.status);
    return list;
  },

  findById: (id) => donations.find((d) => d.id === id),

  create: (donationData) => {
    const id = `don-${Math.floor(100 + Math.random() * 900)}`;
    const newDonation = {
      id,
      createdAt: new Date().toISOString(),
      status: 'AVAILABLE',
      remainingQuantity: Number(donationData.initialQuantity),
      matchedRecipients: [],
      ...donationData,
    };
    donations.unshift(newDonation);
    saveDonations();
    return newDonation;
  },

  update: (id, updates) => {
    const index = donations.findIndex((d) => d.id === id);
    if (index === -1) return null;
    donations[index] = {
      ...donations[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveDonations();
    return donations[index];
  },

  // State machine transition with validation
  updateStatus: (id, nextStatus, metadata = {}) => {
    const donation = donationsStore.findById(id);
    if (!donation) throw new Error(`Donation ${id} not found`);

    const validTransitions = {
      AVAILABLE: ['ASSIGNED', 'PARTIALLY_ACCEPTED', 'CANCELLED'],
      PARTIALLY_ACCEPTED: ['ASSIGNED', 'READY_FOR_PICKUP', 'CANCELLED'],
      ASSIGNED: ['READY_FOR_PICKUP', 'EN_ROUTE_PICKUP', 'CANCELLED'],
      READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED'],
      EN_ROUTE_PICKUP: ['PICKED_UP', 'READY_FOR_PICKUP'],
      PICKED_UP: ['DELIVERED', 'COMPLETED', 'DISCREPANCY_REPORTED'],
      DELIVERED: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: ['REOPENED', 'AVAILABLE'],
      REOPENED: ['AVAILABLE', 'ASSIGNED', 'PARTIALLY_ACCEPTED'],
    };

    const allowed = validTransitions[donation.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(
        `Invalid status transition from "${donation.status}" to "${nextStatus}". Allowed: ${allowed.join(', ') || 'None'}`
      );
    }

    return donationsStore.update(id, {
      status: nextStatus,
      ...metadata,
    });
  },

  reset: () => {
    donations = [...SEED_DONATIONS];
    saveDonations();
    return donations;
  },
};
