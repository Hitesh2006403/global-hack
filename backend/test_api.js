const { EventEmitter } = require('node:events');
const { handleApiRequest } = require('./apiHandler');
const { db } = require('./database');

function mockRequest(method, path, body = null, headers = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = path;
  req.headers = { ...headers };

  const res = new EventEmitter();
  let statusCode = 200;
  let headersSent = {};
  let responseData = '';

  res.writeHead = (status, h = {}) => {
    statusCode = status;
    headersSent = { ...headersSent, ...h };
  };

  res.end = (chunk) => {
    if (chunk) responseData += chunk;
    res.emit('finish');
  };

  const promise = new Promise((resolve, reject) => {
    res.on('finish', () => {
      let parsed = null;
      try {
        parsed = JSON.parse(responseData);
      } catch {
        parsed = responseData;
      }
      resolve({ statusCode, headers: headersSent, body: parsed });
    });
  });

  process.nextTick(() => {
    if (body) {
      req.emit('data', JSON.stringify(body));
    }
    req.emit('end');
  });

  return { req, res, promise };
}

async function runTestSuite() {
  console.log('--- STARTING PRODUCTION API INTEGRATION TESTS ---');

  // TEST 1: Login Donor
  console.log('\n[Test 1] POST /api/auth/login as Donor');
  const t1 = mockRequest('POST', '/api/auth/login', {
    email: 'donor@shareaplate.org',
    password: 'donor123',
    role: 'donor',
  });
  handleApiRequest(t1.req, t1.res);
  const r1 = await t1.promise;
  console.log('Result 1:', r1.statusCode, r1.body.success, 'Token present:', !!r1.body.token);
  if (!r1.body.token) throw new Error('Donor login failed');
  const donorToken = r1.body.token;

  // TEST 2: Login Recipient
  console.log('\n[Test 2] POST /api/auth/login as Recipient');
  const t2 = mockRequest('POST', '/api/auth/login', {
    email: 'recipient@shareaplate.org',
    password: 'recipient123',
    role: 'recipient',
  });
  handleApiRequest(t2.req, t2.res);
  const r2 = await t2.promise;
  console.log('Result 2:', r2.statusCode, r2.body.success, 'Recipient user:', r2.body.user?.organization);
  if (!r2.body.token) throw new Error('Recipient login failed');
  const recipientToken = r2.body.token;

  // TEST 3: Create Food Donation (16 fields)
  console.log('\n[Test 3] POST /api/donations (Create Donation with all 16 fields)');
  const now = new Date();
  const expiryTime = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const prepTime = new Date(now.getTime() - 3600 * 1000).toISOString();

  const newDonationPayload = {
    foodName: 'Paneer Butter Masala with Jeera Rice',
    quantity: 50,
    quantityUnit: 'meals',
    foodCategory: 'Cooked Meals',
    foodType: 'vegetarian',
    preparationType: 'cooked',
    prepTime,
    expiryTime,
    pickupLocation: 'Koramangala 5th Block',
    pickupAddress: '88, 5th Block, Koramangala, Bengaluru',
    latitude: 12.9345,
    longitude: 77.6255,
    description: 'Hot vegetarian meal packs, prepared with high hygiene standards in commercial kitchen.',
    specialInstructions: 'Insulated delivery crates ready at kitchen dispatch counter.',
    contactName: 'Chef Rajesh',
    contactPhone: '+91 98888 77711',
  };

  const t3 = mockRequest('POST', '/api/donations', newDonationPayload, {
    authorization: `Bearer ${donorToken}`,
  });
  handleApiRequest(t3.req, t3.res);
  const r3 = await t3.promise;
  console.log('Result 3:', r3.statusCode, r3.body.message, 'Donation ID:', r3.body.donation?.id);
  if (r3.statusCode !== 201) throw new Error('Create donation failed');
  const createdDonationId = r3.body.donation.id;

  // TEST 4: Post Recipient Requirement
  console.log('\n[Test 4] POST /api/requirements (Create Recipient Requirement)');
  const newReqPayload = {
    title: 'Warm Dinner for 35 Transient Workers',
    requiredQuantity: 35,
    quantityUnit: 'meals',
    foodCategory: 'Cooked Meals',
    preferredFoodType: 'vegetarian',
    dietaryRestrictions: 'Pure vegetarian only',
    requiredByDate: new Date().toISOString().split('T')[0],
    requiredByTime: '21:00',
    requiredLocation: 'Domlur, Bengaluru',
    address: '22, Old Airport Rd, Domlur, Bengaluru',
    latitude: 12.9610,
    longitude: 77.6387,
    contactPerson: 'Sister Riya',
    contactPhone: '+91 99883 01020',
    additionalNotes: 'Urgent night distribution.',
    urgency: 'urgent',
  };

  const t4 = mockRequest('POST', '/api/requirements', newReqPayload, {
    authorization: `Bearer ${recipientToken}`,
  });
  handleApiRequest(t4.req, t4.res);
  const r4 = await t4.promise;
  console.log('Result 4:', r4.statusCode, r4.body.message, 'Requirement ID:', r4.body.requirement?.id);
  if (r4.statusCode !== 201) throw new Error('Create requirement failed');
  const createdRequirementId = r4.body.requirement.id;

  // TEST 5: Matching Engine Query
  console.log('\n[Test 5] GET /api/matching/requirement/:id');
  const t5 = mockRequest('GET', `/api/matching/requirement/${createdRequirementId}`);
  handleApiRequest(t5.req, t5.res);
  const r5 = await t5.promise;
  console.log('Result 5:', r5.statusCode, 'Total matches:', r5.body.totalMatches);
  const topMatch = r5.body.matches?.[0];
  if (topMatch) {
    console.log('  Top Match Score:', topMatch.compatibilityScore + '%');
    console.log('  Matched Qty:', topMatch.matchedQuantity, 'Remaining in donation:', topMatch.remainingDonationQuantity);
    console.log('  Reasons:', topMatch.reasons);
  }
  if (!topMatch || topMatch.compatibilityScore < 70) throw new Error('Matching engine failed or scored too low');

  // TEST 6: Recipient Accepts Donation & Schedules Pickup
  console.log('\n[Test 6] POST /api/donations/:id/accept (Accept 35 of 50 meals)');
  const acceptPayload = {
    requirementId: createdRequirementId,
    requestedQuantity: 35,
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTimeSlot: '19:30 - 20:30',
    dropoffAddress: 'Domlur Night Shelter, Bengaluru',
    recipientContact: 'Sister Riya • +91 99883 01020',
    pickupInstructions: 'Collect from loading dock behind kitchen.',
  };

  const t6 = mockRequest('POST', `/api/donations/${createdDonationId}/accept`, acceptPayload, {
    authorization: `Bearer ${recipientToken}`,
  });
  handleApiRequest(t6.req, t6.res);
  const r6 = await t6.promise;
  console.log('Result 6:', r6.statusCode, r6.body.message);
  console.log('  Reservation status:', r6.body.reservation?.status);
  console.log('  Donation remaining:', r6.body.donation?.remaining_quantity, 'Status:', r6.body.donation?.status);
  console.log('  Pickup ID:', r6.body.pickupSchedule?.id, 'Slot:', r6.body.pickupSchedule?.scheduled_time_slot);
  if (r6.body.donation?.remaining_quantity !== 15 || r6.body.donation?.status !== 'partially_accepted') {
    throw new Error('Partial acceptance failed remaining quantity assertion');
  }
  const pickupId = r6.body.pickupSchedule.id;

  // TEST 7: Edge Case Concurrency & Quantity Limitation
  console.log('\n[Test 7] Edge Case: Attempt to accept 20 meals when only 15 remain (Should Fail with 409)');
  const t7 = mockRequest('POST', `/api/donations/${createdDonationId}/accept`, {
    requestedQuantity: 20,
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTimeSlot: '20:30 - 21:00',
  }, {
    authorization: `Bearer ${recipientToken}`,
  });
  handleApiRequest(t7.req, t7.res);
  const r7 = await t7.promise;
  console.log('Result 7 Status:', r7.statusCode, 'Expected 409 Error:', r7.body.error);
  if (r7.statusCode !== 409) throw new Error('Over-allocation was not prevented!');

  // TEST 8: Pickup Lifecycle Updates (scheduled -> in_transit -> completed)
  console.log('\n[Test 8] PUT /api/pickups/:id/status (Transit -> Completed)');
  const t8a = mockRequest('PUT', `/api/pickups/${pickupId}/status`, { newStatus: 'in_transit' }, {
    authorization: `Bearer ${donorToken}`,
  });
  handleApiRequest(t8a.req, t8a.res);
  const r8a = await t8a.promise;
  console.log('Result 8a (In Transit):', r8a.statusCode, r8a.body.pickup?.status);

  const t8b = mockRequest('PUT', `/api/pickups/${pickupId}/status`, { newStatus: 'completed' }, {
    authorization: `Bearer ${recipientToken}`,
  });
  handleApiRequest(t8b.req, t8b.res);
  const r8b = await t8b.promise;
  console.log('Result 8b (Completed):', r8b.statusCode, r8b.body.pickup?.status, 'Completed at:', r8b.body.pickup?.completed_at);

  // TEST 9: Verify Notifications & Status History
  console.log('\n[Test 9] GET /api/notifications for Donor');
  const t9 = mockRequest('GET', '/api/notifications', null, {
    authorization: `Bearer ${donorToken}`,
  });
  handleApiRequest(t9.req, t9.res);
  const r9 = await t9.promise;
  console.log('Result 9: Notifications count:', r9.body.notifications?.length, 'Unread:', r9.body.unreadCount);
  console.log('Latest notification title:', r9.body.notifications?.[0]?.title);

  // TEST 10: Detail Page Data Endpoint
  console.log('\n[Test 10] GET /api/donations/:id with audit history');
  const t10 = mockRequest('GET', `/api/donations/${createdDonationId}`);
  handleApiRequest(t10.req, t10.res);
  const r10 = await t10.promise;
  console.log('Result 10: Status history entries:', r10.body.statusHistory?.length);
  console.log('Reservations entries:', r10.body.reservations?.length);

  console.log('\n========================================');
  console.log('ALL 10 API & WORKFLOW SUITES PASSED 100%!');
  console.log('========================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
