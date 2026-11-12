/**
 * Intelligent Food Donation Matching Engine
 * 
 * Weighted Scoring Matrix (Configurable):
 * - Food Type Compatibility: 25%
 * - Food Category Compatibility: 20%
 * - Quantity Compatibility: 20%
 * - Geographic Proximity: 15%
 * - Expiry & Deadline Buffer: 15%
 * - Pickup Window Availability: 5%
 * Total = 100%
 */

// Configurable weights
const MATCH_WEIGHTS = {
  foodType: 25,
  foodCategory: 20,
  quantity: 20,
  proximity: 15,
  expiryBuffer: 15,
  pickupWindow: 5,
};

/**
 * Calculate distance in km between two coordinate pairs using Haversine formula
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return null;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Evaluate single pair eligibility & compatibility
 */
function evaluateMatch(donation, requirement) {
  const reasons = [];
  const warnings = [];
  const breakdown = {
    foodType: 0,
    foodCategory: 0,
    quantity: 0,
    proximity: 0,
    expiryBuffer: 0,
    pickupWindow: 0,
  };

  const now = new Date();
  const expiryDate = new Date(donation.expiry_time);

  // 1. ELIGIBILITY CHECKS

  // A. Check expiry
  if (expiryDate <= now) {
    return {
      eligible: false,
      disqualifyReason: 'Donation has already passed its safe-consumption deadline.',
    };
  }

  // B. Check remaining quantity
  if (donation.remaining_quantity <= 0) {
    return {
      eligible: false,
      disqualifyReason: 'Donation has no remaining available quantity.',
    };
  }

  // C. Check requirement status
  if (requirement.remaining_quantity <= 0 || ['fulfilled', 'cancelled', 'expired'].includes(requirement.status)) {
    return {
      eligible: false,
      disqualifyReason: 'Recipient requirement is already fulfilled or inactive.',
    };
  }

  // D. Unit compatibility
  const normDonUnit = (donation.quantity_unit || '').trim().toLowerCase();
  const normReqUnit = (requirement.quantity_unit || '').trim().toLowerCase();
  if (normDonUnit !== normReqUnit) {
    // If one is meals and one is kg, incompatible
    return {
      eligible: false,
      disqualifyReason: `Incompatible units: Donation is in "${donation.quantity_unit}" while requirement requests "${requirement.quantity_unit}".`,
    };
  }

  // E. Dietary Incompatibility: Vegetarian / Vegan requirement with Non-vegetarian food
  const donType = (donation.food_type || '').toLowerCase();
  const reqPref = (requirement.preferred_food_type || '').toLowerCase();

  if (['vegetarian', 'vegan'].includes(reqPref) && donType === 'non-vegetarian') {
    return {
      eligible: false,
      disqualifyReason: `Strict dietary conflict: Recipient requires ${reqPref} food, but donation is non-vegetarian.`,
    };
  }

  if (reqPref === 'vegan' && donType === 'vegetarian') {
    return {
      eligible: false,
      disqualifyReason: 'Strict dietary conflict: Recipient requires vegan (100% plant-based) food, but donation is vegetarian (contains dairy/eggs).',
    };
  }

  // F. Deadline check: Pickup must be possible before safe consumption expiry
  const reqDeadlineStr = `${requirement.required_by_date}T${requirement.required_by_time || '23:59:59'}`;
  const reqDeadLine = new Date(reqDeadlineStr);
  if (isNaN(reqDeadLine.getTime())) {
    // If invalid date string, fall back to expiry comparison
  } else if (expiryDate < reqDeadLine) {
    return {
      eligible: false,
      disqualifyReason: 'Donation food expires before the required delivery/distribution time.',
    };
  }

  // 2. WEIGHTED SCORING

  // Parameter 1: Food Type Compatibility (25%)
  if (reqPref === 'any') {
    breakdown.foodType = MATCH_WEIGHTS.foodType;
    reasons.push('Recipient accepts any food type (100% type compatibility).');
  } else if (reqPref === donType) {
    breakdown.foodType = MATCH_WEIGHTS.foodType;
    reasons.push(`Exact dietary match for ${donType} requirement.`);
  } else if (reqPref === 'vegetarian' && donType === 'vegan') {
    breakdown.foodType = MATCH_WEIGHTS.foodType;
    reasons.push('Vegan donation fully satisfies vegetarian requirement.');
  } else if (reqPref === 'non-vegetarian') {
    breakdown.foodType = MATCH_WEIGHTS.foodType * 0.9;
    reasons.push(`${donType} food acceptable for non-vegetarian preferences.`);
  }

  // Parameter 2: Food Category Compatibility (20%)
  const donCat = (donation.food_category || '').toLowerCase();
  const reqCat = (requirement.food_category || '').toLowerCase();
  if (donCat === reqCat) {
    breakdown.foodCategory = MATCH_WEIGHTS.foodCategory;
    reasons.push(`Exact food category match: ${donation.food_category}.`);
  } else if (reqCat === 'any' || !reqCat) {
    breakdown.foodCategory = MATCH_WEIGHTS.foodCategory * 0.9;
    reasons.push('Category is open/unrestricted.');
  } else {
    breakdown.foodCategory = MATCH_WEIGHTS.foodCategory * 0.3;
    warnings.push(`Category differs: Recipient asked for "${requirement.food_category}", donor listed "${donation.food_category}".`);
  }

  // Parameter 3: Quantity Compatibility (20%)
  const donAvail = donation.remaining_quantity;
  const reqNeed = requirement.remaining_quantity;
  let matchedQuantity = 0;
  let isFullMatch = false;
  let isPartialMatch = false;

  if (donAvail >= reqNeed) {
    matchedQuantity = reqNeed;
    isFullMatch = true;
    breakdown.quantity = MATCH_WEIGHTS.quantity;
    reasons.push(`Full quantity match: ${donAvail} ${donation.quantity_unit} available covers full requirement of ${reqNeed}.`);
  } else {
    matchedQuantity = donAvail;
    isPartialMatch = true;
    const ratio = donAvail / reqNeed;
    breakdown.quantity = Math.round(MATCH_WEIGHTS.quantity * ratio * 10) / 10;
    warnings.push(`Partial quantity match: Donation supplies ${donAvail} of ${reqNeed} ${requirement.quantity_unit} needed (${Math.round(ratio * 100)}% coverage).`);
  }

  // Parameter 4: Geographic Proximity (15%)
  const distanceKm = calculateHaversineDistance(
    donation.latitude,
    donation.longitude,
    requirement.latitude,
    requirement.longitude
  );

  if (distanceKm != null) {
    if (distanceKm <= 2.0) {
      breakdown.proximity = MATCH_WEIGHTS.proximity;
      reasons.push(`Immediate neighborhood proximity (${distanceKm} km away).`);
    } else if (distanceKm <= 5.0) {
      breakdown.proximity = MATCH_WEIGHTS.proximity * 0.85;
      reasons.push(`Close local radius (${distanceKm} km away).`);
    } else if (distanceKm <= 10.0) {
      breakdown.proximity = MATCH_WEIGHTS.proximity * 0.6;
      reasons.push(`Moderate transit distance (${distanceKm} km away).`);
    } else if (distanceKm <= 20.0) {
      breakdown.proximity = MATCH_WEIGHTS.proximity * 0.35;
      warnings.push(`Extended distance (${distanceKm} km away); transport coordination required.`);
    } else {
      breakdown.proximity = MATCH_WEIGHTS.proximity * 0.15;
      warnings.push(`Significant distance (${distanceKm} km away).`);
    }
  } else {
    // String matching on location name if coordinates missing
    const locDon = (donation.pickup_location || '').toLowerCase();
    const locReq = (requirement.required_location || '').toLowerCase();
    if (locDon && locReq && (locDon.includes(locReq) || locReq.includes(locDon))) {
      breakdown.proximity = MATCH_WEIGHTS.proximity * 0.9;
      reasons.push('Matching area/locality verified.');
    } else {
      breakdown.proximity = MATCH_WEIGHTS.proximity * 0.5;
    }
  }

  // Parameter 5: Expiry & Deadline Buffer (15%)
  const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilExpiry >= 6) {
    breakdown.expiryBuffer = MATCH_WEIGHTS.expiryBuffer;
    reasons.push(`Generous fresh buffer: ${Math.round(hoursUntilExpiry * 10) / 10} hours remaining before deadline.`);
  } else if (hoursUntilExpiry >= 3) {
    breakdown.expiryBuffer = MATCH_WEIGHTS.expiryBuffer * 0.85;
    reasons.push(`Safe buffer: ${Math.round(hoursUntilExpiry * 10) / 10} hours remaining before expiry.`);
  } else if (hoursUntilExpiry >= 1.5) {
    breakdown.expiryBuffer = MATCH_WEIGHTS.expiryBuffer * 0.65;
    warnings.push(`Expiring relatively soon: ${Math.round(hoursUntilExpiry * 10) / 10} hours remaining.`);
  } else {
    breakdown.expiryBuffer = MATCH_WEIGHTS.expiryBuffer * 0.3;
    warnings.push(`Urgent pickup required: under ${Math.round(hoursUntilExpiry * 60)} minutes until safe consumption deadline.`);
  }

  // Parameter 6: Pickup Window Availability (5%)
  if (donation.pickup_window_start && donation.pickup_window_end) {
    const winStart = new Date(donation.pickup_window_start);
    const winEnd = new Date(donation.pickup_window_end);
    if (now >= winStart && now <= winEnd) {
      breakdown.pickupWindow = MATCH_WEIGHTS.pickupWindow;
      reasons.push('Pickup window is open right now.');
    } else if (winStart > now) {
      breakdown.pickupWindow = MATCH_WEIGHTS.pickupWindow * 0.8;
      reasons.push(`Pickup opens at ${winStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
    } else {
      breakdown.pickupWindow = MATCH_WEIGHTS.pickupWindow * 0.4;
      warnings.push('Designated pickup window has passed; coordinate directly.');
    }
  } else {
    breakdown.pickupWindow = MATCH_WEIGHTS.pickupWindow * 0.7;
  }

  // Calculate Total Compatibility Score
  const rawScore =
    breakdown.foodType +
    breakdown.foodCategory +
    breakdown.quantity +
    breakdown.proximity +
    breakdown.expiryBuffer +
    breakdown.pickupWindow;

  // Bonus for urgent requirements where food is available immediately
  let finalScore = Math.min(100, Math.round(rawScore));
  if (requirement.urgency === 'emergency') {
    reasons.push('High-priority emergency recipient request.');
  }

  return {
    eligible: true,
    compatibilityScore: finalScore,
    matchedQuantity,
    remainingDonationQuantity: donation.remaining_quantity - matchedQuantity,
    remainingRequirementQuantity: requirement.remaining_quantity - matchedQuantity,
    isFullMatch,
    isPartialMatch,
    distanceKm,
    hoursUntilExpiry: Math.round(hoursUntilExpiry * 10) / 10,
    breakdown,
    reasons,
    warnings,
  };
}

/**
 * Find all matching donations for a given recipient requirement
 */
function findMatchesForRequirement(db, requirementId) {
  const req = db.prepare('SELECT * FROM recipient_requirements WHERE id = ?').get(requirementId);
  if (!req) return [];

  // Get all active donations
  const donations = db.prepare(`
    SELECT d.*, u.full_name as donor_name, u.organization as donor_org, u.phone as donor_phone, u.email as donor_email
    FROM donations d
    JOIN users u ON d.donor_id = u.id
    WHERE d.status IN ('available', 'matched', 'partially_accepted')
      AND d.remaining_quantity > 0
      AND datetime(d.expiry_time) > datetime('now')
    ORDER BY d.created_at DESC
  `).all();

  const results = [];
  for (const don of donations) {
    const evaluation = evaluateMatch(don, req);
    if (evaluation.eligible) {
      results.push({
        donation: don,
        requirement: req,
        ...evaluation,
      });
    }
  }

  // Sort by compatibility score descending
  results.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  return results;
}

/**
 * Find all matching recipient requirements for a given donation
 */
function findMatchesForDonation(db, donationId) {
  const don = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId);
  if (!don) return [];

  const requirements = db.prepare(`
    SELECT r.*, u.full_name as recipient_name, u.organization as recipient_org, u.phone as recipient_phone, u.email as recipient_email
    FROM recipient_requirements r
    JOIN users u ON r.recipient_id = u.id
    WHERE r.status IN ('open', 'partially_matched', 'matched')
      AND r.remaining_quantity > 0
    ORDER BY 
      CASE r.urgency WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
      r.created_at ASC
  `).all();

  const results = [];
  for (const req of requirements) {
    const evaluation = evaluateMatch(don, req);
    if (evaluation.eligible) {
      results.push({
        donation: don,
        requirement: req,
        ...evaluation,
      });
    }
  }

  results.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  return results;
}

module.exports = {
  MATCH_WEIGHTS,
  calculateHaversineDistance,
  evaluateMatch,
  findMatchesForRequirement,
  findMatchesForDonation,
};
