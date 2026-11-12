require('dotenv').config();
const { connectDB, closeDB } = require('../src/config/db');
const User = require('../src/models/User');
const { ROLES } = require('../src/constants/roles');

/**
 * Database Seed Script for Development and Demonstration Environments.
 * SECURITY: Refuses to run if NODE_ENV === 'production'.
 * Passwords must be provided via environment variables.
 */
const runSeed = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Seed Error] Seed script cannot be run in production environments.');
    process.exit(1);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@shareaplate.org';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;

  if (!adminPassword || !demoPassword) {
    console.error(
      '[Seed Error] SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD environment variables are required to seed demo accounts.'
    );
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('[Seed] Connected to database. Preparing demo accounts...');

    const demoUsers = [
      {
        name: 'System Administrator',
        email: adminEmail,
        password: adminPassword,
        role: ROLES.ADMIN,
        phone: '+919900000001',
        isVerified: true,
        isActive: true,
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716],
        },
        address: {
          street: 'Admin Headquarters, MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          formattedAddress: 'MG Road, Bengaluru, Karnataka 560001',
        },
        organization: {
          name: 'Share A Plate Admin Foundation',
          regNo: 'ADMIN-CORP-01',
          capacity: 0,
        },
      },
      {
        name: 'Grand Royal Banquet Hall',
        email: 'donor@grandroyal.com',
        password: demoPassword,
        role: ROLES.DONOR,
        phone: '+919900000002',
        isVerified: true,
        isActive: true,
        location: {
          type: 'Point',
          coordinates: [77.5913, 12.9255],
        },
        address: {
          street: '8th Block, Jayanagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560082',
          formattedAddress: '8th Block, Jayanagar, Bengaluru, Karnataka 560082',
        },
        organization: {
          name: 'Grand Royal Catering & Events',
          regNo: 'BLR-CAT-4581',
          capacity: 500,
        },
      },
      {
        name: 'Sunshine Orphanage & Shelter',
        email: 'recipient@sunshine.org',
        password: demoPassword,
        role: ROLES.RECIPIENT,
        phone: '+919900000003',
        isVerified: true,
        isActive: true,
        location: {
          type: 'Point',
          coordinates: [77.5998, 12.9345],
        },
        address: {
          street: '14 Bannerghatta Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560076',
          formattedAddress: 'Bannerghatta Road, Bengaluru, Karnataka 560076',
        },
        organization: {
          name: 'Sunshine Welfare Trust',
          regNo: 'NGO-BLR-8820',
          capacity: 85,
        },
      },
      {
        name: 'Ramesh Express Logistics',
        email: 'agent@delivery.com',
        password: demoPassword,
        role: ROLES.DELIVERY_AGENT,
        phone: '+919900000004',
        isVerified: true,
        isActive: true,
        location: {
          type: 'Point',
          coordinates: [77.5854, 12.9302],
        },
        address: {
          street: '4th Main, JP Nagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560078',
          formattedAddress: '4th Main, JP Nagar, Bengaluru, Karnataka 560078',
        },
        organization: {
          name: 'Rapid Food Logistics Services',
          regNo: 'LOG-BLR-1029',
          capacity: 30,
        },
      },
    ];

    for (const userData of demoUsers) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`[Seed] User already exists: ${userData.email} (${userData.role}) - skipped`);
      } else {
        await User.create(userData);
        console.log(`[Seed] Created demo user: ${userData.email} (${userData.role})`);
      }
    }

    console.log('[Seed] Database seeding completed successfully.');
    await closeDB();
    process.exit(0);
  } catch (err) {
    console.error(`[Seed Error] Seeding failed: ${err.message}`);
    await closeDB();
    process.exit(1);
  }
};

runSeed();
