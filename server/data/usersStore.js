import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'users.json');

const INITIAL_USERS = [
  {
    id: 'user-donor-1',
    name: 'Chef Marco Rossi',
    organizationName: 'Grand Hyatt Banquet & Bistro',
    role: 'donor',
    email: 'marco@grandhyatt.org',
    password: 'donor123',
    phone: '+91 98765 43210',
    address: 'Hyatt Regency, MG Road, Tech City, Sector 4',
    city: 'Bengaluru',
    rating: 4.9,
    totalDonations: 142,
    verified: true,
    fssaiNumber: 'FSSAI-21424010000492',
    authProvider: 'local',
  },
  {
    id: 'user-recipient-1',
    name: 'Sister Teresa Maria',
    organizationName: 'Grace Hope Children Shelter',
    role: 'recipient',
    email: 'contact@gracehope.org',
    password: 'shelter123',
    phone: '+91 91234 56789',
    address: '14 Sunshine Cross, Near St. Anne School',
    city: 'Bengaluru',
    beneficiariesCount: 85,
    verified: true,
    rating: 4.8,
    ngoRegId: 'NGO-KA-2023-0182',
    authProvider: 'local',
  },
  {
    id: 'user-delivery-1',
    name: 'Vikram Singh (Rider #42)',
    organizationName: 'Share A Plate Rapid Fleet',
    role: 'delivery',
    email: 'vikram@shareaplate.org',
    password: 'rider123',
    phone: '+91 99887 76655',
    vehicleType: 'Electric Cargo Scooter (Thermal Insulated Box)',
    vehicleNumber: 'KA-01-EQ-9872',
    rating: 4.95,
    completedTrips: 312,
    verified: true,
    authProvider: 'local',
  },
  {
    id: 'user-admin-1',
    name: 'Ananya Sharma',
    organizationName: 'Share A Plate Operations Command',
    role: 'admin',
    email: 'ops@shareaplate.org',
    password: 'admin123',
    phone: '+91 80000 11223',
    permissions: ['all'],
    verified: true,
    adminClearanceKey: 'ADM-SEC-9941',
    authProvider: 'local',
  },
];

let users = [];

const loadUsers = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      users = JSON.parse(data);
    } else {
      users = [...INITIAL_USERS];
      saveUsers();
    }
  } catch (err) {
    console.error('Error loading users store:', err);
    users = [...INITIAL_USERS];
  }
};

const saveUsers = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving users store:', err);
  }
};

loadUsers();

export const usersStore = {
  getAll: () => users,

  findById: (id) => users.find((u) => u.id === id),

  findByEmail: (email) =>
    users.find((u) => u.email.toLowerCase() === email.toLowerCase()),

  findByGoogleId: (googleId) =>
    users.find((u) => u.googleId === googleId),

  createUser: (userData) => {
    const newUser = {
      id: `user-${userData.role || 'donor'}-${Date.now()}`,
      verified: true,
      rating: 5.0,
      createdAt: new Date().toISOString(),
      ...userData,
    };
    users.push(newUser);
    saveUsers();
    return newUser;
  },

  updateUser: (id, updates) => {
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
    saveUsers();
    return users[index];
  },
};
