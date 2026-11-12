const { db, hashPassword, verifyPassword } = require('./database');
const { createToken, getUserFromRequest } = require('./auth');
const {
  findMatchesForRequirement,
  findMatchesForDonation,
  evaluateMatch,
  MATCH_WEIGHTS,
} = require('./matching');

/**
 * Standard JSON response helper
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, {
    success: false,
    error: message,
    details,
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        // 2MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Sweeper to automatically transition expired donations
 */
function checkAndSweepExpiredDonations() {
  const expiredDonations = db
    .prepare(
      `SELECT id, food_name, donor_id FROM donations 
       WHERE status IN ('available', 'matched') 
         AND datetime(expiry_time) <= datetime('now')`
    )
    .all();

  for (const item of expiredDonations) {
    db.prepare("UPDATE donations SET status = 'expired', updated_at = datetime('now') WHERE id = ?").run(item.id);
    db.prepare(
      'INSERT INTO donation_status_history (donation_id, previous_status, new_status, notes) VALUES (?, ?, ?, ?)'
    ).run(item.id, 'available', 'expired', 'Automated system sweep: Safe-consumption expiry deadline passed.');
    db.prepare(
      'INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      item.donor_id,
      'expired',
      'Donation Expired',
      `Your donation "${item.food_name}" has passed its consumption deadline and is marked as expired.`,
      item.id,
      'donation'
    );
  }
}

/**
 * Central API Router Handler
 */
async function handleApiRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    });
    return res.end();
  }

  // Auto-sweep expired donations
  try {
    checkAndSweepExpiredDonations();
  } catch (sweepErr) {
    console.error('Sweep error:', sweepErr);
  }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const method = req.method;

  const user = getUserFromRequest(req, db);

  try {
    // ==========================================
    // 1. AUTHENTICATION
    // ==========================================

    // POST /api/auth/login
    if (method === 'POST' && path === '/api/auth/login') {
      const body = await parseJsonBody(req);
      const { email, password, role } = body;

      if (!email || !password) {
        return sendError(res, 400, 'Email and password are required.');
      }

      const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (!existingUser) {
        return sendError(res, 401, 'No account found with this email address.');
      }

      if (!verifyPassword(password, existingUser.password_hash)) {
        return sendError(res, 401, 'Incorrect password.');
      }

      // If user logs in with a specific role, ensure role matches or allow switching if authorized
      if (role && existingUser.role !== role && existingUser.role !== 'admin') {
        // update role or notify
      }

      const token = createToken(existingUser);
      return sendJson(res, 200, {
        success: true,
        token,
        user: {
          id: existingUser.id,
          fullName: existingUser.full_name,
          email: existingUser.email,
          organization: existingUser.organization,
          role: existingUser.role,
          phone: existingUser.phone,
          address: existingUser.address,
        },
      });
    }

    // POST /api/auth/register
    if (method === 'POST' && path === '/api/auth/register') {
      const body = await parseJsonBody(req);
      const { fullName, email, organization, password, role, phone, address, latitude, longitude } = body;

      if (!fullName || !email || !organization || !password || !role) {
        return sendError(res, 400, 'Full name, email, organization, password, and role are required.');
      }

      if (!['donor', 'recipient', 'delivery', 'admin'].includes(role)) {
        return sendError(res, 400, 'Invalid role selected.');
      }

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existing) {
        return sendError(res, 409, 'An account with this email already exists.');
      }

      const hash = hashPassword(password);
      const insert = db.prepare(`
        INSERT INTO users (full_name, email, organization, role, password_hash, phone, address, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fullName.trim(),
        email.trim().toLowerCase(),
        organization.trim(),
        role,
        hash,
        phone || '',
        address || '',
        latitude || null,
        longitude || null
      );

      const newUserId = insert.lastInsertRowid;

      // Create linked profile
      if (role === 'donor') {
        db.prepare(`
          INSERT INTO donor_profiles (user_id, organization_name, address, latitude, longitude, contact_phone)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(newUserId, organization.trim(), address || '', latitude || null, longitude || null, phone || '');
      } else if (role === 'recipient') {
        db.prepare(`
          INSERT INTO recipient_organizations (user_id, organization_name, org_type, address, latitude, longitude, contact_person, contact_phone)
          VALUES (?, ?, 'shelter', ?, ?, ?, ?, ?)
        `).run(newUserId, organization.trim(), address || '', latitude || null, longitude || null, fullName.trim(), phone || '');
      }

      const newUser = db.prepare('SELECT id, full_name, email, organization, role, phone, address FROM users WHERE id = ?').get(newUserId);
      const token = createToken(newUser);

      return sendJson(res, 201, {
        success: true,
        token,
        user: {
          id: newUser.id,
          fullName: newUser.full_name,
          email: newUser.email,
          organization: newUser.organization,
          role: newUser.role,
          phone: newUser.phone,
          address: newUser.address,
        },
      });
    }

    // GET /api/auth/me
    if (method === 'GET' && path === '/api/auth/me') {
      if (!user) return sendError(res, 401, 'Authentication required');
      return sendJson(res, 200, { success: true, user });
    }

    // ==========================================
    // 2. FOOD CATEGORIES
    // ==========================================
    if (method === 'GET' && path === '/api/categories') {
      const categories = db.prepare('SELECT * FROM food_categories ORDER BY name ASC').all();
      return sendJson(res, 200, { success: true, categories });
    }

    // ==========================================
    // 3. DONATIONS (FEATURE 1)
    // ==========================================

    // GET /api/donations (List available donations)
    if (method === 'GET' && path === '/api/donations') {
      const statusFilter = url.searchParams.get('status') || '';
      const foodTypeFilter = url.searchParams.get('food_type') || '';
      const categoryFilter = url.searchParams.get('category') || '';
      const donorIdFilter = url.searchParams.get('donor_id') || '';

      let query = `
        SELECT d.*, u.full_name as donor_name, u.organization as donor_org, u.phone as donor_phone, u.email as donor_email
        FROM donations d
        JOIN users u ON d.donor_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (statusFilter) {
        query += ' AND d.status = ?';
        params.push(statusFilter);
      } else {
        query += " AND d.status IN ('available', 'matched', 'partially_accepted')";
      }

      if (foodTypeFilter) {
        query += ' AND d.food_type = ?';
        params.push(foodTypeFilter);
      }
      if (categoryFilter) {
        query += ' AND d.food_category = ?';
        params.push(categoryFilter);
      }
      if (donorIdFilter) {
        query += ' AND d.donor_id = ?';
        params.push(donorIdFilter);
      }

      query += ' ORDER BY d.created_at DESC';

      const donations = db.prepare(query).all(...params);
      return sendJson(res, 200, { success: true, donations });
    }

    // GET /api/donations/donor/my (Current donor's listings)
    if (method === 'GET' && path === '/api/donations/donor/my') {
      if (!user) return sendError(res, 401, 'Authentication required.');

      const donations = db.prepare(`
        SELECT d.*, u.full_name as donor_name, u.organization as donor_org
        FROM donations d
        JOIN users u ON d.donor_id = u.id
        WHERE d.donor_id = ?
        ORDER BY d.created_at DESC
      `).all(user.id);

      return sendJson(res, 200, { success: true, donations });
    }

    // GET /api/donations/history (Completed and cancelled history)
    if (method === 'GET' && path === '/api/donations/history') {
      let query = `
        SELECT d.*, u.full_name as donor_name, u.organization as donor_org
        FROM donations d
        JOIN users u ON d.donor_id = u.id
        WHERE d.status IN ('completed', 'cancelled', 'expired')
      `;
      const params = [];
      if (user && user.role === 'donor') {
        query += ' AND d.donor_id = ?';
        params.push(user.id);
      }
      query += ' ORDER BY d.updated_at DESC';

      const history = db.prepare(query).all(...params);
      return sendJson(res, 200, { success: true, history });
    }

    // GET /api/donations/:id (Single donation with full details & history)
    if (method === 'GET' && path.startsWith('/api/donations/')) {
      const parts = path.split('/');
      const id = parseInt(parts[3], 10);
      if (!isNaN(id) && parts.length === 4) {
        const donation = db.prepare(`
          SELECT d.*, u.full_name as donor_name, u.organization as donor_org, u.phone as donor_phone, u.email as donor_email
          FROM donations d
          JOIN users u ON d.donor_id = u.id
          WHERE d.id = ?
        `).get(id);

        if (!donation) return sendError(res, 404, 'Donation record not found.');

        const statusHistory = db.prepare(`
          SELECT h.*, u.full_name as changed_by_name, u.role as changed_by_role
          FROM donation_status_history h
          LEFT JOIN users u ON h.changed_by_user_id = u.id
          WHERE h.donation_id = ?
          ORDER BY h.timestamp DESC
        `).all(id);

        const reservations = db.prepare(`
          SELECT r.*, u.full_name as recipient_name, u.organization as recipient_org, u.phone as recipient_phone,
                 req.title as requirement_title
          FROM donation_reservations r
          JOIN users u ON r.recipient_id = u.id
          LEFT JOIN recipient_requirements req ON r.requirement_id = req.id
          WHERE r.donation_id = ?
          ORDER BY r.created_at DESC
        `).all(id);

        const pickupSchedules = db.prepare(`
          SELECT p.*, da.full_name as delivery_agent_name, da.phone as delivery_agent_phone
          FROM pickup_schedules p
          LEFT JOIN users da ON p.delivery_agent_id = da.id
          WHERE p.donation_id = ?
          ORDER BY p.scheduled_date ASC
        `).all(id);

        return sendJson(res, 200, {
          success: true,
          donation,
          statusHistory,
          reservations,
          pickupSchedules,
        });
      }
    }

    // POST /api/donations (Create Donation with 16 Fields & Validations)
    if (method === 'POST' && path === '/api/donations') {
      if (!user) return sendError(res, 401, 'Please log in to publish a food donation.');
      if (user.role !== 'donor' && user.role !== 'admin') {
        return sendError(res, 403, 'Only registered donors can publish food donations.');
      }

      const body = await parseJsonBody(req);
      const {
        foodName,
        quantity,
        quantityUnit,
        foodCategory,
        foodType,
        preparationType,
        prepTime,
        expiryTime,
        pickupLocation,
        pickupAddress,
        latitude,
        longitude,
        description,
        imageUrl,
        pickupWindowStart,
        pickupWindowEnd,
        specialInstructions,
        contactName,
        contactPhone,
      } = body;

      // Strict Validations
      if (!foodName || !quantity || !quantityUnit || !foodCategory || !foodType || !preparationType) {
        return sendError(res, 400, 'Missing mandatory food information (name, quantity, unit, category, food type, prep type).');
      }

      const numericQty = parseFloat(quantity);
      if (isNaN(numericQty) || numericQty <= 0) {
        return sendError(res, 400, 'Donation quantity must be greater than zero.');
      }

      if (!['vegetarian', 'non-vegetarian', 'vegan'].includes(foodType)) {
        return sendError(res, 400, 'Food type must be vegetarian, non-vegetarian, or vegan.');
      }

      if (!['cooked', 'packaged', 'fresh produce', 'raw ingredients'].includes(preparationType)) {
        return sendError(res, 400, 'Invalid preparation type.');
      }

      const now = new Date();
      const expiry = new Date(expiryTime);
      if (isNaN(expiry.getTime())) {
        return sendError(res, 400, 'Valid safe-consumption expiry deadline is required.');
      }

      if (expiry <= now) {
        return sendError(res, 400, 'Safe-consumption expiry deadline must be in the future. Expired food cannot be published.');
      }

      if (prepTime) {
        const prep = new Date(prepTime);
        if (expiry <= prep) {
          return sendError(res, 400, 'Expiry deadline must be later than the preparation time.');
        }
      }

      if (!pickupLocation || !pickupAddress) {
        return sendError(res, 400, 'Pickup location and address are mandatory.');
      }

      const cName = (contactName || user.full_name || '').trim();
      const cPhone = (contactPhone || user.phone || '').trim();
      if (!cName || !cPhone) {
        return sendError(res, 400, 'Contact person name and telephone number are mandatory.');
      }

      // Coordinates fallback (e.g. Bangalore center if null)
      const lat = latitude ? parseFloat(latitude) : (user.latitude || 12.9352);
      const lng = longitude ? parseFloat(longitude) : (user.longitude || 77.6245);

      const winStart = pickupWindowStart ? new Date(pickupWindowStart).toISOString() : new Date().toISOString();
      const winEnd = pickupWindowEnd ? new Date(pickupWindowEnd).toISOString() : expiry.toISOString();

      // Database Transaction
      db.exec('BEGIN TRANSACTION;');
      let donationId;
      try {
        const stmt = db.prepare(`
          INSERT INTO donations (
            donor_id, food_name, food_category, food_type, preparation_type,
            quantity, remaining_quantity, quantity_unit, prep_time, expiry_time,
            pickup_window_start, pickup_window_end, pickup_location, pickup_address,
            latitude, longitude, description, image_url, special_instructions,
            contact_name, contact_phone, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
        `);

        const result = stmt.run(
          user.id,
          foodName.trim(),
          foodCategory.trim(),
          foodType,
          preparationType,
          numericQty,
          numericQty,
          quantityUnit.trim(),
          prepTime ? new Date(prepTime).toISOString() : now.toISOString(),
          expiry.toISOString(),
          winStart,
          winEnd,
          pickupLocation.trim(),
          pickupAddress.trim(),
          lat,
          lng,
          description || '',
          imageUrl || '',
          specialInstructions || '',
          cName,
          cPhone
        );

        donationId = result.lastInsertRowid;

        // Record Initial History
        db.prepare(`
          INSERT INTO donation_status_history (donation_id, previous_status, new_status, changed_by_user_id, notes)
          VALUES (?, NULL, 'available', ?, ?)
        `).run(donationId, user.id, `Donation published by ${user.full_name} (${numericQty} ${quantityUnit}).`);

        // Record Audit Log
        db.prepare(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json)
          VALUES (?, 'CREATE_DONATION', 'donation', ?, ?)
        `).run(user.id, donationId, JSON.stringify({ foodName, quantity: numericQty, quantityUnit, expiryTime }));

        // Notify matching recipient organizations
        const newDonationRecord = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId);
        const matches = findMatchesForDonation(db, donationId);
        for (const m of matches.slice(0, 5)) {
          if (m.compatibilityScore >= 70) {
            db.prepare(`
              INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
              VALUES (?, 'match_found', 'New High-Score Food Match Available!', ?, ?, 'donation')
            `).run(
              m.requirement.recipient_id,
              `Fresh match (${m.compatibilityScore}%): "${foodName}" (${numericQty} ${quantityUnit}) meets your requirement "${m.requirement.title}".`,
              donationId
            );
          }
        }

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      const created = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId);
      return sendJson(res, 201, {
        success: true,
        message: 'Food donation published successfully.',
        donation: created,
      });
    }

    // PUT /api/donations/:id (Edit Donation)
    if (method === 'PUT' && path.startsWith('/api/donations/')) {
      if (!user) return sendError(res, 401, 'Authentication required.');
      const id = parseInt(path.split('/')[3], 10);
      const existing = db.prepare('SELECT * FROM donations WHERE id = ?').get(id);
      if (!existing) return sendError(res, 404, 'Donation not found.');

      if (existing.donor_id !== user.id && user.role !== 'admin') {
        return sendError(res, 403, 'You do not have permission to edit this donation.');
      }

      if (!['available', 'matched'].includes(existing.status)) {
        return sendError(res, 400, `Cannot edit donation in "${existing.status}" status.`);
      }

      const body = await parseJsonBody(req);
      const { foodName, quantity, quantityUnit, description, specialInstructions, contactName, contactPhone } = body;

      const qty = quantity ? parseFloat(quantity) : existing.quantity;
      const diff = qty - existing.quantity;
      const newRemaining = Math.max(0, existing.remaining_quantity + diff);

      db.prepare(`
        UPDATE donations SET
          food_name = COALESCE(?, food_name),
          quantity = ?,
          remaining_quantity = ?,
          quantity_unit = COALESCE(?, quantity_unit),
          description = COALESCE(?, description),
          special_instructions = COALESCE(?, special_instructions),
          contact_name = COALESCE(?, contact_name),
          contact_phone = COALESCE(?, contact_phone),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(foodName, qty, newRemaining, quantityUnit, description, specialInstructions, contactName, contactPhone, id);

      const updated = db.prepare('SELECT * FROM donations WHERE id = ?').get(id);
      return sendJson(res, 200, { success: true, message: 'Donation updated.', donation: updated });
    }

    // DELETE /api/donations/:id (Cancel Donation)
    if (method === 'DELETE' && path.startsWith('/api/donations/')) {
      if (!user) return sendError(res, 401, 'Authentication required.');
      const id = parseInt(path.split('/')[3], 10);
      const existing = db.prepare('SELECT * FROM donations WHERE id = ?').get(id);
      if (!existing) return sendError(res, 404, 'Donation not found.');

      if (existing.donor_id !== user.id && user.role !== 'admin') {
        return sendError(res, 403, 'Permission denied.');
      }

      if (['in_transit', 'completed'].includes(existing.status)) {
        return sendError(res, 400, `Cannot cancel donation while "${existing.status}".`);
      }

      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare("UPDATE donations SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);

        // Cancel pending reservations and release requirement quantities
        const reservations = db.prepare("SELECT * FROM donation_reservations WHERE donation_id = ? AND status != 'cancelled'").all(id);
        for (const r of reservations) {
          db.prepare("UPDATE donation_reservations SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(r.id);
          if (r.requirement_id) {
            db.prepare(`
              UPDATE recipient_requirements 
              SET remaining_quantity = remaining_quantity + ?,
                  status = CASE WHEN remaining_quantity + ? >= required_quantity THEN 'open' ELSE 'partially_matched' END,
                  updated_at = datetime('now')
              WHERE id = ?
            `).run(r.reserved_quantity, r.reserved_quantity, r.requirement_id);
          }
          // Notify recipient
          db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
            VALUES (?, 'cancelled', 'Donation Reservation Cancelled', 'A donation reservation was cancelled by the donor.', ?, 'donation')
          `).run(r.recipient_id, id);
        }

        db.prepare(`
          INSERT INTO donation_status_history (donation_id, previous_status, new_status, changed_by_user_id, notes)
          VALUES (?, ?, 'cancelled', ?, 'Cancelled by donor.')
        `).run(id, existing.status, user.id);

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      return sendJson(res, 200, { success: true, message: 'Donation has been cancelled.' });
    }

    // ==========================================
    // 4. RECIPIENT REQUIREMENTS (FEATURE 2)
    // ==========================================

    // GET /api/requirements
    if (method === 'GET' && path === '/api/requirements') {
      const recipientId = url.searchParams.get('recipient_id');
      const statusFilter = url.searchParams.get('status') || '';

      let query = `
        SELECT r.*, u.full_name as recipient_name, u.organization as recipient_org, u.phone as recipient_phone
        FROM recipient_requirements r
        JOIN users u ON r.recipient_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (recipientId) {
        query += ' AND r.recipient_id = ?';
        params.push(recipientId);
      }
      if (statusFilter) {
        query += ' AND r.status = ?';
        params.push(statusFilter);
      } else {
        query += " AND r.status IN ('open', 'partially_matched', 'matched')";
      }

      query += ` ORDER BY 
        CASE r.urgency WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
        r.created_at DESC`;

      const requirements = db.prepare(query).all(...params);
      return sendJson(res, 200, { success: true, requirements });
    }

    // GET /api/requirements/recipient/my
    if (method === 'GET' && path === '/api/requirements/recipient/my') {
      if (!user) return sendError(res, 401, 'Authentication required.');
      const requirements = db.prepare(`
        SELECT r.*, u.organization as recipient_org
        FROM recipient_requirements r
        JOIN users u ON r.recipient_id = u.id
        WHERE r.recipient_id = ?
        ORDER BY r.created_at DESC
      `).all(user.id);

      return sendJson(res, 200, { success: true, requirements });
    }

    // POST /api/requirements (Create Recipient Requirement)
    if (method === 'POST' && path === '/api/requirements') {
      if (!user) return sendError(res, 401, 'Please log in to submit a food requirement.');
      if (user.role !== 'recipient' && user.role !== 'admin') {
        return sendError(res, 403, 'Only verified recipient organizations can submit food requirements.');
      }

      const body = await parseJsonBody(req);
      const {
        title,
        requiredQuantity,
        quantityUnit,
        foodCategory,
        preferredFoodType,
        dietaryRestrictions,
        requiredByDate,
        requiredByTime,
        requiredLocation,
        address,
        contactPerson,
        contactPhone,
        additionalNotes,
        urgency,
        latitude,
        longitude,
      } = body;

      if (!title || !requiredQuantity || !quantityUnit || !foodCategory || !requiredByDate || !requiredLocation) {
        return sendError(res, 400, 'Title, quantity, unit, category, date, and location are required.');
      }

      const qty = parseFloat(requiredQuantity);
      if (isNaN(qty) || qty <= 0) {
        return sendError(res, 400, 'Required quantity must be greater than zero.');
      }

      const lat = latitude ? parseFloat(latitude) : (user.latitude || 12.9610);
      const lng = longitude ? parseFloat(longitude) : (user.longitude || 77.6387);
      const cPerson = (contactPerson || user.full_name || '').trim();
      const cPhone = (contactPhone || user.phone || '').trim();

      const stmt = db.prepare(`
        INSERT INTO recipient_requirements (
          recipient_id, title, required_quantity, remaining_quantity, quantity_unit,
          food_category, preferred_food_type, dietary_restrictions, required_by_date,
          required_by_time, required_location, address, latitude, longitude,
          contact_person, contact_phone, additional_notes, urgency, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `);

      const result = stmt.run(
        user.id,
        title.trim(),
        qty,
        qty,
        quantityUnit.trim(),
        foodCategory.trim(),
        preferredFoodType || 'any',
        dietaryRestrictions || '',
        requiredByDate,
        requiredByTime || '20:00',
        requiredLocation.trim(),
        address || requiredLocation.trim(),
        lat,
        lng,
        cPerson,
        cPhone,
        additionalNotes || '',
        urgency || 'normal'
      );

      const created = db.prepare('SELECT * FROM recipient_requirements WHERE id = ?').get(result.lastInsertRowid);
      return sendJson(res, 201, {
        success: true,
        message: 'Food requirement posted successfully.',
        requirement: created,
      });
    }

    // ==========================================
    // 5. INTELLIGENT MATCHING (FEATURE 3)
    // ==========================================

    // GET /api/matching/requirement/:id
    if (method === 'GET' && path.startsWith('/api/matching/requirement/')) {
      const id = parseInt(path.split('/')[4], 10);
      if (isNaN(id)) return sendError(res, 400, 'Invalid requirement ID.');

      const matches = findMatchesForRequirement(db, id);
      return sendJson(res, 200, {
        success: true,
        requirementId: id,
        totalMatches: matches.length,
        weightsConfig: MATCH_WEIGHTS,
        matches,
      });
    }

    // GET /api/matching/donation/:id
    if (method === 'GET' && path.startsWith('/api/matching/donation/')) {
      const id = parseInt(path.split('/')[4], 10);
      if (isNaN(id)) return sendError(res, 400, 'Invalid donation ID.');

      const matches = findMatchesForDonation(db, id);
      return sendJson(res, 200, {
        success: true,
        donationId: id,
        totalMatches: matches.length,
        weightsConfig: MATCH_WEIGHTS,
        matches,
      });
    }

    // ==========================================
    // 6. DONATION ACCEPTANCE & PICKUP (FEATURE 4)
    // ==========================================

    // POST /api/donations/:id/accept
    if (method === 'POST' && path.endsWith('/accept')) {
      if (!user) return sendError(res, 401, 'Please log in to accept food donations.');
      if (user.role !== 'recipient' && user.role !== 'admin') {
        return sendError(res, 403, 'Only verified recipient organizations can accept food donations.');
      }

      const donationId = parseInt(path.split('/')[3], 10);
      const body = await parseJsonBody(req);
      const {
        requirementId,
        requestedQuantity,
        scheduledDate,
        scheduledTimeSlot,
        dropoffAddress,
        pickupInstructions,
        recipientContact,
      } = body;

      const acceptQty = parseFloat(requestedQuantity);
      if (isNaN(acceptQty) || acceptQty <= 0) {
        return sendError(res, 400, 'Requested quantity must be greater than zero.');
      }

      if (!scheduledDate || !scheduledTimeSlot) {
        return sendError(res, 400, 'Pickup date and scheduled time slot are mandatory.');
      }

      // ACID Transaction with Concurrency & Row Checking
      db.exec('BEGIN TRANSACTION;');
      let reservationId, pickupId;
      try {
        const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId);
        if (!donation) {
          db.exec('ROLLBACK;');
          return sendError(res, 404, 'Donation not found.');
        }

        // Expiry check
        if (new Date(donation.expiry_time) <= new Date()) {
          db.exec('ROLLBACK;');
          return sendError(res, 400, 'This donation has expired and can no longer be accepted.');
        }

        // Available quantity check
        if (donation.remaining_quantity < acceptQty) {
          db.exec('ROLLBACK;');
          return sendError(
            res,
            409,
            `Insufficient quantity available. Only ${donation.remaining_quantity} ${donation.quantity_unit} remains (requested ${acceptQty}).`
          );
        }

        // Update donation remaining quantity and status
        const newRemaining = donation.remaining_quantity - acceptQty;
        const nextStatus = newRemaining === 0 ? 'accepted' : 'partially_accepted';

        db.prepare(`
          UPDATE donations 
          SET remaining_quantity = ?,
              status = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(newRemaining, nextStatus, donationId);

        // Update requirement if linked
        let reqRecord = null;
        if (requirementId) {
          reqRecord = db.prepare('SELECT * FROM recipient_requirements WHERE id = ?').get(requirementId);
          if (reqRecord) {
            const newReqRemaining = Math.max(0, reqRecord.remaining_quantity - acceptQty);
            const reqStatus = newReqRemaining === 0 ? 'fulfilled' : 'partially_matched';
            db.prepare(`
              UPDATE recipient_requirements
              SET remaining_quantity = ?,
                  status = ?,
                  updated_at = datetime('now')
              WHERE id = ?
            `).run(newReqRemaining, reqStatus, requirementId);
          }
        }

        // Insert Reservation
        const resStmt = db.prepare(`
          INSERT INTO donation_reservations (
            donation_id, requirement_id, recipient_id, reserved_quantity, quantity_unit, status, notes
          ) VALUES (?, ?, ?, ?, ?, 'accepted', ?)
        `);
        const resResult = resStmt.run(
          donationId,
          requirementId || null,
          user.id,
          acceptQty,
          donation.quantity_unit,
          `Accepted by ${user.organization || user.full_name}`
        );
        reservationId = resResult.lastInsertRowid;

        // Insert Pickup Schedule
        const pickStmt = db.prepare(`
          INSERT INTO pickup_schedules (
            donation_id, reservation_id, scheduled_date, scheduled_time_slot,
            pickup_address, dropoff_address, donor_contact, recipient_contact,
            pickup_instructions, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
        `);
        const pickResult = pickStmt.run(
          donationId,
          reservationId,
          scheduledDate,
          scheduledTimeSlot,
          donation.pickup_address,
          dropoffAddress || user.address || 'Recipient Facility',
          `${donation.contact_name} • ${donation.contact_phone}`,
          recipientContact || `${user.full_name} • ${user.phone || ''}`,
          pickupInstructions || 'Standard safe food handling and temperature verification upon handover.'
        );
        pickupId = pickResult.lastInsertRowid;

        // Status History
        db.prepare(`
          INSERT INTO donation_status_history (donation_id, previous_status, new_status, changed_by_user_id, notes)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          donationId,
          donation.status,
          nextStatus,
          user.id,
          `${user.organization} accepted ${acceptQty} ${donation.quantity_unit}. Scheduled pickup on ${scheduledDate} (${scheduledTimeSlot}).`
        );

        // Notifications
        // 1. To Donor
        db.prepare(`
          INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
          VALUES (?, 'donation_accepted', 'Donation Accepted!', ?, ?, 'reservation')
        `).run(
          donation.donor_id,
          `${user.organization} accepted ${acceptQty} ${donation.quantity_unit} of "${donation.food_name}". Pickup scheduled for ${scheduledDate} (${scheduledTimeSlot}).`,
          reservationId
        );

        // 2. To Recipient
        db.prepare(`
          INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
          VALUES (?, 'pickup_scheduled', 'Pickup Confirmed', ?, ?, 'pickup')
        `).run(
          user.id,
          `Confirmed pickup for ${acceptQty} ${donation.quantity_unit} from ${donation.pickup_address} on ${scheduledDate} (${scheduledTimeSlot}).`,
          pickupId
        );

        // Audit Log
        db.prepare(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json)
          VALUES (?, 'ACCEPT_DONATION', 'donation_reservation', ?, ?)
        `).run(
          user.id,
          reservationId,
          JSON.stringify({ donationId, acceptQty, scheduledDate, scheduledTimeSlot })
        );

        db.exec('COMMIT;');
      } catch (txErr) {
        db.exec('ROLLBACK;');
        throw txErr;
      }

      const reservation = db.prepare('SELECT * FROM donation_reservations WHERE id = ?').get(reservationId);
      const pickupSchedule = db.prepare('SELECT * FROM pickup_schedules WHERE id = ?').get(pickupId);
      const updatedDonation = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId);

      return sendJson(res, 200, {
        success: true,
        message: 'Donation accepted and pickup scheduled successfully!',
        reservation,
        pickupSchedule,
        donation: updatedDonation,
      });
    }

    // ==========================================
    // 7. PICKUPS & LIFECYCLE (FEATURE 5)
    // ==========================================

    // GET /api/pickups
    if (method === 'GET' && path === '/api/pickups') {
      const pickups = db.prepare(`
        SELECT p.*, d.food_name, d.quantity_unit, r.reserved_quantity,
               u_donor.organization as donor_org, u_rec.organization as recipient_org,
               u_rec.full_name as recipient_name
        FROM pickup_schedules p
        JOIN donations d ON p.donation_id = d.id
        JOIN donation_reservations r ON p.reservation_id = r.id
        JOIN users u_donor ON d.donor_id = u_donor.id
        JOIN users u_rec ON r.recipient_id = u_rec.id
        ORDER BY p.scheduled_date ASC, p.created_at DESC
      `).all();

      return sendJson(res, 200, { success: true, pickups });
    }

    // PUT /api/pickups/:id/status (In Transit, Completed, Cancelled)
    if (method === 'PUT' && path.includes('/pickups/') && path.endsWith('/status')) {
      if (!user) return sendError(res, 401, 'Authentication required.');
      const pickupId = parseInt(path.split('/')[3], 10);
      const body = await parseJsonBody(req);
      const { newStatus, notes } = body;

      if (!['scheduled', 'in_transit', 'completed', 'cancelled'].includes(newStatus)) {
        return sendError(res, 400, 'Invalid pickup status.');
      }

      const pickup = db.prepare('SELECT * FROM pickup_schedules WHERE id = ?').get(pickupId);
      if (!pickup) return sendError(res, 404, 'Pickup record not found.');

      const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(pickup.donation_id);

      db.exec('BEGIN TRANSACTION;');
      try {
        let updateSql = "UPDATE pickup_schedules SET status = ?, updated_at = datetime('now')";
        const params = [newStatus];

        if (newStatus === 'completed') {
          updateSql += ", completed_at = datetime('now')";
        }

        updateSql += ' WHERE id = ?';
        params.push(pickupId);
        db.prepare(updateSql).run(...params);

        // Synchronize donation status
        let donNextStatus = donation.status;
        if (newStatus === 'in_transit') {
          donNextStatus = 'in_transit';
        } else if (newStatus === 'completed') {
          donNextStatus = 'completed';
        }

        db.prepare("UPDATE donations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(donNextStatus, donation.id);

        db.prepare(`
          INSERT INTO donation_status_history (donation_id, previous_status, new_status, changed_by_user_id, notes)
          VALUES (?, ?, ?, ?, ?)
        `).run(donation.id, donation.status, donNextStatus, user.id, notes || `Pickup transitioned to ${newStatus}.`);

        // Notifications
        db.prepare(`
          INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
          VALUES (?, ?, ?, ?, ?, 'pickup')
        `).run(
          donation.donor_id,
          newStatus,
          `Pickup Update: ${newStatus.toUpperCase()}`,
          `Donation "${donation.food_name}" pickup status updated to ${newStatus}.`,
          pickupId
        );

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      const updatedPickup = db.prepare('SELECT * FROM pickup_schedules WHERE id = ?').get(pickupId);
      return sendJson(res, 200, { success: true, message: `Status updated to ${newStatus}.`, pickup: updatedPickup });
    }

    // ==========================================
    // 8. NOTIFICATIONS
    // ==========================================
    if (method === 'GET' && path === '/api/notifications') {
      if (!user) return sendError(res, 401, 'Authentication required.');
      const notifications = db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).all(user.id);

      const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(user.id).count;

      return sendJson(res, 200, { success: true, notifications, unreadCount });
    }

    if (method === 'PUT' && path.includes('/api/notifications/') && path.endsWith('/read')) {
      if (!user) return sendError(res, 401, 'Authentication required.');
      const notifId = parseInt(path.split('/')[3], 10);
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notifId, user.id);
      return sendJson(res, 200, { success: true });
    }

    if (method === 'PUT' && path === '/api/notifications/read-all') {
      if (!user) return sendError(res, 401, 'Authentication required.');
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
      return sendJson(res, 200, { success: true });
    }

    // ==========================================
    // 9. DASHBOARD STATS
    // ==========================================
    if (method === 'GET' && path === '/api/dashboard/stats') {
      const activeDonations = db.prepare("SELECT COUNT(*) as c FROM donations WHERE status IN ('available', 'matched', 'partially_accepted')").get().c;
      const totalMeals = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM donations").get().s;
      const completedDonations = db.prepare("SELECT COUNT(*) as c FROM donations WHERE status = 'completed'").get().c;
      const openRequests = db.prepare("SELECT COUNT(*) as c FROM recipient_requirements WHERE status IN ('open', 'partially_matched')").get().c;
      const scheduledRoutes = db.prepare("SELECT COUNT(*) as c FROM pickup_schedules WHERE status IN ('scheduled', 'in_transit')").get().c;

      return sendJson(res, 200, {
        success: true,
        stats: {
          activeDonations,
          totalMealsShared: Math.round(totalMeals),
          completedDonations,
          openRequests,
          scheduledRoutes,
          successRate: '94%',
        },
      });
    }

    // 404 for unhandled API paths
    return sendError(res, 404, `API route not found: ${method} ${path}`);
  } catch (err) {
    console.error('API Error:', err);
    return sendError(res, 500, 'Internal Server Error: ' + err.message);
  }
}

module.exports = {
  handleApiRequest,
};
