require('dotenv').config();
const { connectDB, closeDB } = require('../src/config/db');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const RecipientRequirement = require('../src/models/RecipientRequirement');
const Notification = require('../src/models/Notification');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS, ACCEPTANCE_STATUS, REQUIREMENT_STATUS } = require('../src/constants/status');

/**
 * Realistic Bengaluru Demo Dataset Seeder for Share A Plate.
 *
 * Safe & Idempotent: Reuses existing accounts from scripts/seed.js if present.
 * SECURITY: Refuses to run if NODE_ENV === 'production'.
 * Passwords are read strictly from SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD.
 */
const runDemoSeed = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Demo Seed Fatal] This script is forbidden in production environments.');
    process.exit(1);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@shareaplate.test';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;

  if (!adminPassword || !demoPassword) {
    console.error(
      '[Demo Seed Fatal] Both SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD must be configured in .env'
    );
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('\n[Demo Seed] Connected to database. Seeding realistic Bengaluru demonstration data...\n');

    // =========================================================================
    // 1. DEMO USERS (1 Admin, 3 Donors, 3 Verified Recipients, 1 Unverified Recipient, 2 Drivers)
    // =========================================================================
    const userDefinitions = [
      // 1 Admin
      {
        name: 'System Administrator',
        email: adminEmail,
        password: adminPassword,
        role: ROLES.ADMIN,
        phone: '+919900000001',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: { street: 'Admin HQ, MG Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', formattedAddress: 'MG Road, Bengaluru, Karnataka 560001' },
        organization: { name: 'Share A Plate Central Operations', regNo: 'ADMIN-OPS-01', capacity: 0 },
      },
      // Donor 1: Restaurant (Grand Royal Banquet Hall)
      {
        name: 'Grand Royal Banquet & Restaurant',
        email: 'donor@grandroyal.com',
        password: demoPassword,
        role: ROLES.DONOR,
        phone: '+919900000002',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.6412, 12.9784] },
        address: { street: '100ft Road, Indiranagar', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', formattedAddress: '100ft Road, Indiranagar, Bengaluru 560038' },
        organization: { name: 'Grand Royal Banquet & Catering Ltd', regNo: 'BLR-CAT-4581', capacity: 500 },
      },
      // Donor 2: Student Hostel Mess (Greenwood Residency)
      {
        name: 'Greenwood Student Hostel & Mess',
        email: 'donor.hostel@kitchen.test',
        password: demoPassword,
        role: ROLES.DONOR,
        phone: '+919900000012',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.6245, 12.9352] },
        address: { street: '5th Block, Koramangala', city: 'Bengaluru', state: 'Karnataka', postalCode: '560095', formattedAddress: '5th Block, Koramangala, Bengaluru 560095' },
        organization: { name: 'Greenwood Student Housing Trust', regNo: 'HST-BLR-9921', capacity: 350 },
      },
      // Donor 3: Corporate Event Organizer (Silicon Apex Catering)
      {
        name: 'Silicon Apex Event Caterers',
        email: 'donor.events@caterers.test',
        password: demoPassword,
        role: ROLES.DONOR,
        phone: '+919900000013',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.7499, 12.9698] },
        address: { street: 'ITPL Main Road, Whitefield', city: 'Bengaluru', state: 'Karnataka', postalCode: '560066', formattedAddress: 'ITPL Main Road, Whitefield, Bengaluru 560066' },
        organization: { name: 'Silicon Apex Hospitality Services', regNo: 'CORP-CAT-1102', capacity: 1200 },
      },
      // Recipient 1: Orphanage (Sunshine Orphanage)
      {
        name: 'Sunshine Orphanage & Child Care',
        email: 'recipient@sunshine.org',
        password: demoPassword,
        role: ROLES.RECIPIENT,
        phone: '+919900000003',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.5998, 12.9345] },
        address: { street: '14 Bannerghatta Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560076', formattedAddress: 'Bannerghatta Road, Bengaluru 560076' },
        organization: { name: 'Sunshine Welfare Trust', regNo: 'NGO-BLR-8820', capacity: 85 },
      },
      // Recipient 2: Community Shelter (Asha Care Home)
      {
        name: 'Asha Community Shelter & Home',
        email: 'recipient.shelter@care.test',
        password: demoPassword,
        role: ROLES.RECIPIENT,
        phone: '+919900000014',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.5828, 12.9250] },
        address: { street: '4th T Block, Jayanagar', city: 'Bengaluru', state: 'Karnataka', postalCode: '560041', formattedAddress: '4th T Block, Jayanagar, Bengaluru 560041' },
        organization: { name: 'Asha Social Upliftment Mission', regNo: 'SHL-BLR-4410', capacity: 120 },
      },
      // Recipient 3: Hunger Relief NGO (Bengaluru Food Mission)
      {
        name: 'Bengaluru Food Relief Mission',
        email: 'recipient.ngo@relief.test',
        password: demoPassword,
        role: ROLES.RECIPIENT,
        phone: '+919900000015',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.5713, 12.9982] },
        address: { street: 'Margosa Road, Malleshwaram', city: 'Bengaluru', state: 'Karnataka', postalCode: '560003', formattedAddress: 'Margosa Road, Malleshwaram, Bengaluru 560003' },
        organization: { name: 'Bengaluru Relief Foundation', regNo: 'NGO-BLR-7733', capacity: 250 },
      },
      // Recipient 4: UNVERIFIED Recipient (Hope Community Kitchen)
      {
        name: 'Hope Community Kitchen',
        email: 'recipient.unverified@hope.test',
        password: demoPassword,
        role: ROLES.RECIPIENT,
        phone: '+919900000016',
        isVerified: false, // Intentionally unverified for admin verification demonstration
        isActive: true,
        location: { type: 'Point', coordinates: [77.6784, 12.8452] },
        address: { street: 'Phase 1, Electronic City', city: 'Bengaluru', state: 'Karnataka', postalCode: '560100', formattedAddress: 'Electronic City, Bengaluru 560100' },
        organization: { name: 'Hope Volunteers Initiative', regNo: 'PENDING-REG-99', capacity: 45 },
      },
      // Delivery Agent 1: Ramesh Express
      {
        name: 'Ramesh Express Logistics',
        email: 'agent@delivery.com',
        password: demoPassword,
        role: ROLES.DELIVERY_AGENT,
        phone: '+919900000004',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.5854, 12.9302] },
        address: { street: '4th Main, JP Nagar', city: 'Bengaluru', state: 'Karnataka', postalCode: '560078', formattedAddress: '4th Main, JP Nagar, Bengaluru 560078' },
        organization: { name: 'Rapid Food Logistics Services', regNo: 'LOG-BLR-1029', capacity: 30 },
      },
      // Delivery Agent 2: Pooja Quick Couriers
      {
        name: 'Pooja Rapid Food Couriers',
        email: 'agent.quick@express.test',
        password: demoPassword,
        role: ROLES.DELIVERY_AGENT,
        phone: '+919900000017',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.6385, 12.9116] },
        address: { street: 'Sector 2, HSR Layout', city: 'Bengaluru', state: 'Karnataka', postalCode: '560102', formattedAddress: 'Sector 2, HSR Layout, Bengaluru 560102' },
        organization: { name: 'Green Mile Urban Transport', regNo: 'LOG-BLR-5582', capacity: 40 },
      },
    ];

    const usersMap = {};
    for (const uDef of userDefinitions) {
      let user = await User.findOne({ email: uDef.email });
      if (!user) {
        user = await User.create(uDef);
        console.log(`  [+] Created user: ${user.email} (${user.role})`);
      } else {
        console.log(`  [=] Reused user:  ${user.email} (${user.role})`);
      }
      usersMap[uDef.email] = user;
    }

    const donorRestaurant = usersMap['donor@grandroyal.com'];
    const donorHostel = usersMap['donor.hostel@kitchen.test'];
    const donorEvents = usersMap['donor.events@caterers.test'];
    const recipientSunshine = usersMap['recipient@sunshine.org'];
    const recipientShelter = usersMap['recipient.shelter@care.test'];
    const recipientNGO = usersMap['recipient.ngo@relief.test'];
    const agentRamesh = usersMap['agent@delivery.com'];

    // =========================================================================
    // 2. DEMO DONATIONS (8 in varied states, urgencies, and categories)
    // =========================================================================
    const now = new Date();

    const donationDefinitions = [
      // 1. URGENT (< 25 min to effective expiry): 50 Hot Sambar Rice Meals
      {
        donorId: donorRestaurant._id,
        foodName: '50 Hot Sambar Rice & Poriyal Meals',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 50,
        remainingQuantity: 50,
        unit: 'plates',
        cookedAt: new Date(now.getTime() - 2 * 3600000),
        expiryAt: new Date(now.getTime() + 85 * 60000), // 85m total -> effective (85 - 60) = 25m left
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(now.getTime() - 15 * 60000),
        pickupWindowEnd: new Date(now.getTime() + 20 * 60000),
        packagingType: 'sealed_containers',
        instructions: 'Park at rear loading bay; ring bell for kitchen head',
        location: donorRestaurant.location,
        address: donorRestaurant.address,
        areaLabel: 'Indiranagar Hub, Bengaluru',
        status: DONATION_STATUS.AVAILABLE,
      },
      // 2. URGENT (< 30 min to effective expiry): 30 Fresh Veg Biryani Packets
      {
        donorId: donorHostel._id,
        foodName: '30 Fresh Vegetable Biryani Packets',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 30,
        remainingQuantity: 30,
        unit: 'packets',
        cookedAt: new Date(now.getTime() - 90 * 60000),
        expiryAt: new Date(now.getTime() + 88 * 60000), // effective (88 - 60) = 28m left
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(now.getTime() - 10 * 60000),
        pickupWindowEnd: new Date(now.getTime() + 25 * 60000),
        packagingType: 'sealed_containers',
        instructions: 'Hostel mess gate 2; call security intercom on arrival',
        location: donorHostel.location,
        address: donorHostel.address,
        areaLabel: 'Koramangala 5th Block, Bengaluru',
        status: DONATION_STATUS.AVAILABLE,
      },
      // 3. NORMAL AVAILABLE (4 hours left): 100 Chapati & Paneer Curry Boxes
      {
        donorId: donorEvents._id,
        foodName: '100 Chapati & Paneer Curry Meal Boxes',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 100,
        remainingQuantity: 100,
        unit: 'plates',
        cookedAt: new Date(now.getTime() - 60 * 60000),
        expiryAt: new Date(now.getTime() + 5 * 3600000), // effective (300 - 60) = 240m (4 hours) left
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(now.getTime() + 30 * 60000),
        pickupWindowEnd: new Date(now.getTime() + 3.5 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'Convention center loading dock B',
        location: donorEvents.location,
        address: donorEvents.address,
        areaLabel: 'Whitefield Tech Corridor, Bengaluru',
        status: DONATION_STATUS.AVAILABLE,
      },
      // 4. NORMAL AVAILABLE (Raw Groceries, 24 hours left): 40 kg Rice & Lentils
      {
        donorId: donorHostel._id,
        foodName: '40 kg Sona Masoori Rice & Toor Dal Bags',
        foodType: 'raw_groceries',
        dietaryType: 'vegetarian',
        totalQuantity: 40,
        remainingQuantity: 40,
        unit: 'kg',
        cookedAt: new Date(now.getTime() - 12 * 3600000),
        expiryAt: new Date(now.getTime() + 25 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(now.getTime() + 60 * 60000),
        pickupWindowEnd: new Date(now.getTime() + 18 * 3600000),
        packagingType: 'bulk_vessel',
        instructions: 'Sealed dry storage bags; easy trolley access available',
        location: donorHostel.location,
        address: donorHostel.address,
        areaLabel: 'Koramangala 5th Block, Bengaluru',
        status: DONATION_STATUS.AVAILABLE,
      },
      // 5. PARTIALLY ACCEPTED: 80 Curd Rice Trays (50 claimed by Sunshine, 30 remainder open)
      {
        donorId: donorRestaurant._id,
        foodName: '80 South Indian Curd Rice & Pickle Trays',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 80,
        remainingQuantity: 30, // 80 - 50 = 30 open
        unit: 'plates',
        cookedAt: new Date(now.getTime() - 3 * 3600000),
        expiryAt: new Date(now.getTime() + 4 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(now.getTime() + 15 * 60000),
        pickupWindowEnd: new Date(now.getTime() + 2.5 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'Trays stacked in cooler rack 1',
        location: donorRestaurant.location,
        address: donorRestaurant.address,
        areaLabel: 'Indiranagar Hub, Bengaluru',
        status: DONATION_STATUS.PARTIALLY_ACCEPTED,
        acceptances: [
          {
            recipientId: recipientSunshine._id,
            quantity: 50,
            status: ACCEPTANCE_STATUS.CLAIMED,
            pickupPreference: 'self_pickup',
            claimedAt: new Date(now.getTime() - 45 * 60000),
          },
        ],
      },
      // 6. ACCEPTED (100% Claimed, Pickup Scheduled): 45 Veg Thali Boxes
      {
        donorId: donorHostel._id,
        foodName: '45 Executive Veg Thali Boxes',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 45,
        remainingQuantity: 0,
        unit: 'plates',
        cookedAt: new Date(now.getTime() - 2.5 * 3600000),
        expiryAt: new Date(now.getTime() + 3.5 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(now.getTime() + 20 * 60000),
        pickupWindowEnd: new Date(now.getTime() + 2 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'Ready in dispatch corridor with warming bags',
        location: donorHostel.location,
        address: donorHostel.address,
        areaLabel: 'Koramangala 5th Block, Bengaluru',
        status: DONATION_STATUS.ACCEPTED,
        acceptances: [
          {
            recipientId: recipientShelter._id,
            deliveryAgentId: agentRamesh._id,
            quantity: 45,
            status: ACCEPTANCE_STATUS.PICKUP_SCHEDULED,
            pickupPreference: 'delivery_agent_required',
            claimedAt: new Date(now.getTime() - 90 * 60000),
          },
        ],
      },
      // 7. CANCELLED: 25 Dal Khichdi Pots
      {
        donorId: donorEvents._id,
        foodName: '25 Dal Khichdi Pots',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 25,
        remainingQuantity: 25,
        unit: 'plates',
        cookedAt: new Date(now.getTime() - 5 * 3600000),
        expiryAt: new Date(now.getTime() + 2 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(now.getTime() - 2 * 3600000),
        pickupWindowEnd: new Date(now.getTime() + 60 * 60000),
        packagingType: 'sealed_containers',
        instructions: 'Cancelled by kitchen due to refrigeration issue',
        location: donorEvents.location,
        address: donorEvents.address,
        areaLabel: 'Whitefield Tech Corridor, Bengaluru',
        status: DONATION_STATUS.CANCELLED,
        statusHistory: [
          { status: DONATION_STATUS.AVAILABLE, timestamp: new Date(now.getTime() - 4 * 3600000) },
          { status: DONATION_STATUS.CANCELLED, note: 'Kitchen cooling unit malfunction', timestamp: new Date(now.getTime() - 2 * 3600000) },
        ],
      },
      // 8. EXPIRED: 35 Artisan Breads & Sandwiches
      {
        donorId: donorRestaurant._id,
        foodName: '35 Artisan Sandwiches & Pastries',
        foodType: 'bakery_items',
        dietaryType: 'vegetarian',
        totalQuantity: 35,
        remainingQuantity: 35,
        unit: 'packets',
        cookedAt: new Date(now.getTime() - 10 * 3600000),
        expiryAt: new Date(now.getTime() - 90 * 60000), // In the past
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(now.getTime() - 6 * 3600000),
        pickupWindowEnd: new Date(now.getTime() - 2 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'Expired before claim window closed',
        location: donorRestaurant.location,
        address: donorRestaurant.address,
        areaLabel: 'Indiranagar Hub, Bengaluru',
        status: DONATION_STATUS.EXPIRED,
        statusHistory: [
          { status: DONATION_STATUS.AVAILABLE, timestamp: new Date(now.getTime() - 8 * 3600000) },
          { status: DONATION_STATUS.EXPIRED, note: 'Sweeper marked expired at deadline', timestamp: new Date(now.getTime() - 90 * 60000) },
        ],
      },
    ];

    for (const dDef of donationDefinitions) {
      const existing = await Donation.findOne({ foodName: dDef.foodName });
      if (!existing) {
        await Donation.create(dDef);
        console.log(`  [+] Created donation: "${dDef.foodName}" [${dDef.status}]`);
      } else {
        console.log(`  [=] Reused donation:  "${dDef.foodName}" [${dDef.status}]`);
      }
    }

    // =========================================================================
    // 3. DEMO REQUIREMENTS (4 recipient demand posts)
    // =========================================================================
    const requirementDefinitions = [
      {
        recipientId: recipientSunshine._id,
        title: 'Dinner meals required for 60 children',
        foodType: 'cooked_meals',
        quantityNeeded: 60,
        unit: 'plates',
        dietaryPreference: 'vegetarian',
        neededBy: new Date(now.getTime() + 4 * 3600000),
        urgency: 'HIGH',
        status: REQUIREMENT_STATUS.OPEN,
        location: recipientSunshine.location,
        address: recipientSunshine.address,
      },
      {
        recipientId: recipientShelter._id,
        title: 'Weekly dry grains for community shelter (40 kg)',
        foodType: 'raw_groceries',
        quantityNeeded: 40,
        unit: 'kg',
        dietaryPreference: 'any',
        neededBy: new Date(now.getTime() + 24 * 3600000),
        urgency: 'MEDIUM',
        status: REQUIREMENT_STATUS.OPEN,
        location: recipientShelter.location,
        address: recipientShelter.address,
      },
      {
        recipientId: recipientNGO._id,
        title: 'Fresh bakery items for youth study center',
        foodType: 'bakery_items',
        quantityNeeded: 35,
        unit: 'packets',
        dietaryPreference: 'vegetarian',
        neededBy: new Date(now.getTime() + 5 * 3600000),
        urgency: 'MEDIUM',
        status: REQUIREMENT_STATUS.OPEN,
        location: recipientNGO.location,
        address: recipientNGO.address,
      },
      {
        recipientId: recipientSunshine._id,
        title: 'Urgent afternoon fruit and snack packets',
        foodType: 'packaged_food',
        quantityNeeded: 50,
        unit: 'packets',
        dietaryPreference: 'any',
        neededBy: new Date(now.getTime() + 2 * 3600000),
        urgency: 'CRITICAL',
        status: REQUIREMENT_STATUS.OPEN,
        location: recipientSunshine.location,
        address: recipientSunshine.address,
      },
    ];

    for (const rDef of requirementDefinitions) {
      const existing = await RecipientRequirement.findOne({ title: rDef.title });
      if (!existing) {
        await RecipientRequirement.create(rDef);
        console.log(`  [+] Created requirement: "${rDef.title}"`);
      } else {
        console.log(`  [=] Reused requirement:  "${rDef.title}"`);
      }
    }

    // =========================================================================
    // 4. DEMO NOTIFICATIONS
    // =========================================================================
    const notificationDefinitions = [
      {
        userId: recipientSunshine._id,
        type: 'EXPIRING_SOON',
        title: 'Urgent Food Available Nearby',
        message: '50 Hot Sambar Rice Meals are available near Indiranagar expiring soon.',
        readAt: null,
      },
      {
        userId: recipientShelter._id,
        type: 'STATUS_UPDATE',
        title: 'Pickup Scheduled',
        message: 'Your claim for 45 Executive Veg Thali Boxes has been scheduled for courier pickup.',
        readAt: new Date(),
      },
      {
        userId: donorRestaurant._id,
        type: 'CLAIMED',
        title: 'Donation Portions Claimed',
        message: 'Sunshine Orphanage claimed 50 portions of South Indian Curd Rice Trays.',
        readAt: null,
      },
      {
        userId: usersMap['recipient.unverified@hope.test']._id,
        type: 'STATUS_UPDATE',
        title: 'Verification In Progress',
        message: 'Your recipient application has been received and is currently under administrative review.',
        readAt: null,
      },
    ];

    for (const nDef of notificationDefinitions) {
      const existing = await Notification.findOne({
        userId: nDef.userId,
        title: nDef.title,
      });
      if (!existing) {
        await Notification.create(nDef);
        console.log(`  [+] Created notification: "${nDef.title}"`);
      } else {
        console.log(`  [=] Reused notification:  "${nDef.title}"`);
      }
    }

    // =========================================================================
    // 5. SUMMARY OUTPUT TABLE
    // =========================================================================
    console.log('\n=============================================================================');
    console.log('       SHARE A PLATE — BENGALURU DEMO ENVIRONMENT READY');
    console.log('=============================================================================\n');

    const summaryTable = Object.values(usersMap).map((u) => ({
      'Email Address': u.email,
      Role: u.role,
      Organization: u.organization?.name || u.name,
      Verified: u.isVerified ? 'YES' : 'NO (Demo)',
    }));

    console.table(summaryTable);

    console.log('Dataset Invariants:');
    console.log('  • Users:         10 total (1 Admin, 3 Donors, 3 Verified Recips, 1 Unverified Recip, 2 Drivers)');
    console.log('  • Donations:     8 total (2 Urgent <30m, 2 Normal Available, 1 Partial, 1 Accepted, 1 Cancelled, 1 Expired)');
    console.log('  • Requirements:  4 total (across orphanages & relief NGOs)');
    console.log('  • Notifications: 4 in-app alerts created across accounts');
    console.log('\n[Demo Seed] Done! Database populated safely.\n');

    await closeDB();
    process.exit(0);
  } catch (err) {
    console.error(`\n[Demo Seed Fatal] Failed: ${err.message}`);
    await closeDB();
    process.exit(1);
  }
};

runDemoSeed();
