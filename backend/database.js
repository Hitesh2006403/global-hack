const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DB_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'shareaplate.db');

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode & foreign keys
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      organization TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('donor', 'recipient', 'delivery', 'admin')),
      password_hash TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donor_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_name TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      contact_phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipient_organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_name TEXT NOT NULL,
      org_type TEXT DEFAULT 'shelter' CHECK(org_type IN ('shelter', 'ngo', 'community_kitchen', 'orphanage', 'food_bank')),
      address TEXT,
      latitude REAL,
      longitude REAL,
      contact_person TEXT,
      contact_phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS food_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      safe_storage_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      food_name TEXT NOT NULL,
      food_category TEXT NOT NULL,
      food_type TEXT NOT NULL CHECK(food_type IN ('vegetarian', 'non-vegetarian', 'vegan')),
      preparation_type TEXT NOT NULL CHECK(preparation_type IN ('cooked', 'packaged', 'fresh produce', 'raw ingredients')),
      quantity REAL NOT NULL CHECK(quantity > 0),
      remaining_quantity REAL NOT NULL CHECK(remaining_quantity >= 0),
      quantity_unit TEXT NOT NULL,
      prep_time TEXT NOT NULL,
      expiry_time TEXT NOT NULL,
      pickup_window_start TEXT NOT NULL,
      pickup_window_end TEXT NOT NULL,
      pickup_location TEXT NOT NULL,
      pickup_address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      description TEXT,
      image_url TEXT,
      special_instructions TEXT,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'matched', 'partially_accepted', 'accepted', 'scheduled', 'in_transit', 'completed', 'cancelled', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipient_requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      required_quantity REAL NOT NULL CHECK(required_quantity > 0),
      remaining_quantity REAL NOT NULL CHECK(remaining_quantity >= 0),
      quantity_unit TEXT NOT NULL,
      food_category TEXT NOT NULL,
      preferred_food_type TEXT NOT NULL CHECK(preferred_food_type IN ('vegetarian', 'non-vegetarian', 'vegan', 'any')),
      dietary_restrictions TEXT,
      required_by_date TEXT NOT NULL,
      required_by_time TEXT NOT NULL,
      required_location TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      contact_person TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      additional_notes TEXT,
      urgency TEXT NOT NULL DEFAULT 'normal' CHECK(urgency IN ('normal', 'urgent', 'emergency')),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'partially_matched', 'matched', 'fulfilled', 'cancelled', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donation_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
      requirement_id INTEGER NOT NULL REFERENCES recipient_requirements(id) ON DELETE CASCADE,
      compatibility_score REAL NOT NULL,
      matched_quantity REAL NOT NULL,
      breakdown_json TEXT NOT NULL,
      reasons_json TEXT NOT NULL,
      warnings_json TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'accepted', 'superseded', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(donation_id, requirement_id)
    );

    CREATE TABLE IF NOT EXISTS donation_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE RESTRICT,
      requirement_id INTEGER REFERENCES recipient_requirements(id) ON DELETE SET NULL,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      reserved_quantity REAL NOT NULL CHECK(reserved_quantity > 0),
      quantity_unit TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'accepted' CHECK(status IN ('pending_confirmation', 'accepted', 'pickup_scheduled', 'rejected', 'cancelled')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pickup_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE RESTRICT,
      reservation_id INTEGER NOT NULL REFERENCES donation_reservations(id) ON DELETE CASCADE,
      scheduled_date TEXT NOT NULL,
      scheduled_time_slot TEXT NOT NULL,
      pickup_address TEXT NOT NULL,
      dropoff_address TEXT NOT NULL,
      donor_contact TEXT NOT NULL,
      recipient_contact TEXT NOT NULL,
      pickup_instructions TEXT,
      delivery_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in_transit', 'completed', 'cancelled')),
      confirmed_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donation_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      reference_id INTEGER,
      reference_type TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details_json TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);
    CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
    CREATE INDEX IF NOT EXISTS idx_donations_expiry ON donations(expiry_time);
    CREATE INDEX IF NOT EXISTS idx_requirements_recipient ON recipient_requirements(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_requirements_status ON recipient_requirements(status);
    CREATE INDEX IF NOT EXISTS idx_reservations_donation ON donation_reservations(donation_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_recipient ON donation_reservations(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_status_history_donation ON donation_status_history(donation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
  `);

  seedDefaultData();
}

// Utility: Hash password using crypto PBKDF2
function hashPassword(password) {
  const salt = 'shareaplate_secure_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
}

function verifyPassword(password, storedHash) {
  return hashPassword(password) === storedHash;
}

function seedDefaultData() {
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (countUsers > 0) return;

  // 1. Categories
  const categories = [
    ['Cooked Meals', 'Freshly prepared hot and nutritious meal packs', 'Store above 60°C or chill below 4°C immediately.'],
    ['Bakery & Snacks', 'Bread, buns, sandwiches, and dry savories', 'Keep in dry, cool conditions away from direct sunlight.'],
    ['Fresh Produce', 'Fruits, raw vegetables, and unpeeled greens', 'Inspect for freshness, store in ventilated crates.'],
    ['Packaged Groceries', 'Sealed rice, lentils, flour, and non-perishables', 'Keep sealed in moisture-proof containers.'],
    ['Dairy & Beverages', 'Milk, yogurt, juices, and fortified drinks', 'Refrigerate strictly between 2°C and 4°C.']
  ];
  const catStmt = db.prepare('INSERT OR IGNORE INTO food_categories (name, description, safe_storage_notes) VALUES (?, ?, ?)');
  for (const c of categories) catStmt.run(c[0], c[1], c[2]);

  // 2. Default Seed Users
  const users = [
    {
      fullName: 'Vikram Sharma',
      email: 'donor@shareaplate.org',
      org: 'Skyline Bistro & Catering',
      role: 'donor',
      pass: 'donor123',
      phone: '+91 98989 11222',
      address: '14, 5th Cross, Koramangala 4th Block, Bengaluru',
      lat: 12.9352,
      lng: 77.6245
    },
    {
      fullName: 'Aisha Sen',
      email: 'donor2@shareaplate.org',
      org: 'Green Table Events',
      role: 'donor',
      pass: 'donor123',
      phone: '+91 98800 55211',
      address: '88, 100 Feet Rd, Indiranagar, Bengaluru',
      lat: 12.9784,
      lng: 77.6408
    },
    {
      fullName: 'Sister Riya Joseph',
      email: 'recipient@shareaplate.org',
      org: 'New Dawn Night Shelter',
      role: 'recipient',
      pass: 'recipient123',
      phone: '+91 99883 01020',
      address: '22, Old Airport Rd, Domlur, Bengaluru',
      lat: 12.9610,
      lng: 77.6387
    },
    {
      fullName: 'Sonia Rao',
      email: 'recipient2@shareaplate.org',
      org: 'Udaya Community Kitchen',
      role: 'recipient',
      pass: 'recipient123',
      phone: '+91 96540 11091',
      address: '15, ITPL Main Rd, Whitefield, Bengaluru',
      lat: 12.9698,
      lng: 77.7499
    },
    {
      fullName: 'Karthik Nambiar',
      email: 'delivery@shareaplate.org',
      org: 'ShareAPlate Express Logistics',
      role: 'delivery',
      pass: 'delivery123',
      phone: '+91 99877 55310',
      address: 'Sector 3, HSR Layout, Bengaluru',
      lat: 12.9116,
      lng: 77.6444
    },
    {
      fullName: 'Kavya Murthy',
      email: 'admin@shareaplate.org',
      org: 'Share A Plate Foundation',
      role: 'admin',
      pass: 'admin123',
      phone: '+91 90990 10012',
      address: 'MG Road, Bengaluru',
      lat: 12.9756,
      lng: 77.6066
    }
  ];

  const userStmt = db.prepare(`
    INSERT INTO users (full_name, email, organization, role, password_hash, phone, address, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertedUserIds = {};
  for (const u of users) {
    const res = userStmt.run(u.fullName, u.email, u.org, u.role, hashPassword(u.pass), u.phone, u.address, u.lat, u.lng);
    insertedUserIds[u.email] = res.lastInsertRowid;
  }

  // Profiles
  db.prepare(`
    INSERT INTO donor_profiles (user_id, organization_name, address, latitude, longitude, contact_phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(insertedUserIds['donor@shareaplate.org'], 'Skyline Bistro & Catering', '14, 5th Cross, Koramangala 4th Block, Bengaluru', 12.9352, 77.6245, '+91 98989 11222');

  db.prepare(`
    INSERT INTO recipient_organizations (user_id, organization_name, org_type, address, latitude, longitude, contact_person, contact_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(insertedUserIds['recipient@shareaplate.org'], 'New Dawn Night Shelter', 'shelter', '22, Old Airport Rd, Domlur, Bengaluru', 12.9610, 77.6387, 'Sister Riya Joseph', '+91 99883 01020');

  // Seed Initial Donations with realistic future times
  const now = new Date();
  const prepTime = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const expiryToday = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const expirySoon = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString();
  const windowStart = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();

  const donStmt = db.prepare(`
    INSERT INTO donations (
      donor_id, food_name, food_category, food_type, preparation_type,
      quantity, remaining_quantity, quantity_unit, prep_time, expiry_time,
      pickup_window_start, pickup_window_end, pickup_location, pickup_address,
      latitude, longitude, description, special_instructions, contact_name, contact_phone, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const don1 = donStmt.run(
    insertedUserIds['donor@shareaplate.org'],
    'Fresh Vegetable Dum Biryani with Raita',
    'Cooked Meals',
    'vegetarian',
    'cooked',
    60,
    60,
    'meals',
    prepTime,
    expiryToday,
    windowStart,
    windowEnd,
    'Koramangala 4th Block',
    '14, 5th Cross, Koramangala 4th Block, Bengaluru',
    12.9352,
    77.6245,
    'Freshly cooked vegetarian biryani, packaged in hot-sealed food grade containers with cucumber raita.',
    'Keep insulated until pickup. Rear loading dock available.',
    'Vikram Sharma',
    '+91 98989 11222',
    'available'
  );

  const don2 = donStmt.run(
    insertedUserIds['donor2@shareaplate.org'],
    'Assorted Healthy Snack Trays & Fruit Boxes',
    'Bakery & Snacks',
    'vegan',
    'packaged',
    35,
    35,
    'boxes',
    prepTime,
    expirySoon,
    windowStart,
    windowEnd,
    'Indiranagar 100 Feet Rd',
    '88, 100 Feet Rd, Indiranagar, Bengaluru',
    12.9784,
    77.6408,
    'Event surplus containing wholewheat rolls, sliced seasonal fruits, and mixed roasted nuts.',
    'Handle with care. Fruit boxes are pre-chilled.',
    'Aisha Sen',
    '+91 98800 55211',
    'available'
  );

  // Status history for donations
  const histStmt = db.prepare('INSERT INTO donation_status_history (donation_id, previous_status, new_status, changed_by_user_id, notes) VALUES (?, ?, ?, ?, ?)');
  histStmt.run(don1.lastInsertRowid, null, 'available', insertedUserIds['donor@shareaplate.org'], 'Initial publication of surplus food.');
  histStmt.run(don2.lastInsertRowid, null, 'available', insertedUserIds['donor2@shareaplate.org'], 'Initial publication of event surplus.');

  // Seed Initial Recipient Requirements
  const reqStmt = db.prepare(`
    INSERT INTO recipient_requirements (
      recipient_id, title, required_quantity, remaining_quantity, quantity_unit,
      food_category, preferred_food_type, dietary_restrictions, required_by_date,
      required_by_time, required_location, address, latitude, longitude,
      contact_person, contact_phone, additional_notes, urgency, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const todayStr = new Date().toISOString().split('T')[0];

  reqStmt.run(
    insertedUserIds['recipient@shareaplate.org'],
    'Emergency Dinner Meals for Night Shelter Residents',
    40,
    40,
    'meals',
    'Cooked Meals',
    'vegetarian',
    'No artificial preservatives, mild spices for elderly residents',
    todayStr,
    '20:30',
    'Domlur, Bengaluru',
    '22, Old Airport Rd, Domlur, Bengaluru',
    12.9610,
    77.6387,
    'Sister Riya Joseph',
    '+91 99883 01020',
    'We accommodate 40 homeless and transient workers who need wholesome evening nutrition.',
    'urgent',
    'open'
  );

  reqStmt.run(
    insertedUserIds['recipient2@shareaplate.org'],
    'Supplemental Healthy Snacks for Community Center',
    25,
    25,
    'boxes',
    'Bakery & Snacks',
    'vegan',
    '100% plant based',
    todayStr,
    '21:00',
    'Whitefield, Bengaluru',
    '15, ITPL Main Rd, Whitefield, Bengaluru',
    12.9698,
    77.7499,
    'Sonia Rao',
    '+91 96540 11091',
    'Nutritional evening snack distribution for underprivileged children.',
    'normal',
    'open'
  );

  // Seed Initial Audit Log
  db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(insertedUserIds['admin@shareaplate.org'], 'SYSTEM_INIT', 'database', 1, JSON.stringify({ message: 'Production database initialized with schema and seed data.' }));
}

// Automatically initialize on require
initDatabase();

module.exports = {
  db,
  hashPassword,
  verifyPassword,
  initDatabase,
};
