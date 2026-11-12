const { computeCountdown } = require('../services/donationStateService');

/**
 * Calculates Haversine distance in kilometers between two GeoJSON [lng, lat] coordinates.
 */
const calculateHaversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Transforms a Donation document into a role-scoped view enforcing privacy and PII rules.
 *
 * PRIVACY INVARIANTS:
 * - Exact street address, contact phone, and high-precision coordinates are visible ONLY to:
 *   1. Posting donor (owner)
 *   2. Administrator
 *   3. Recipient or delivery agent attached to an active acceptance
 * - All other users receive:
 *   - Coordinates rounded to 2 decimal places (~1.1km approximate radius)
 *   - Street address and phone set to null
 *   - General city/area and computed distanceKm calculated strictly from ROUNDED coordinates, rounded to 1 decimal
 *
 * @param {Object} donationDoc - Mongoose document or plain donation object
 * @param {Object} [viewer=null] - Authenticated user making the request
 * @param {Array|number|Object} [viewerLocationOrDistance=null] - Viewer [lng, lat] or pre-computed distance
 * @returns {Object} Sanitized donation representation
 */
const toDonationView = (donationDoc, viewer = null, viewerLocationOrDistance = null) => {
  const donation = donationDoc.toObject
    ? donationDoc.toObject({ virtuals: true })
    : { ...donationDoc };

  const viewerId = viewer?._id?.toString() || viewer?.id?.toString();
  const viewerRole = viewer?.role;

  const donorIdStr = donation.donorId?._id?.toString() || donation.donorId?.toString();
  const isOwner = Boolean(viewerId && donorIdStr && viewerId === donorIdStr);
  const isAdmin = viewerRole === 'admin';

  // Check if viewer is attached to an acceptance on this donation
  const isAttached =
    Array.isArray(donation.acceptances) &&
    donation.acceptances.some((acc) => {
      const rId = acc.recipientId?._id?.toString() || acc.recipientId?.toString();
      const dId = acc.deliveryAgentId?._id?.toString() || acc.deliveryAgentId?.toString();
      return (viewerId && rId === viewerId) || (viewerId && dId === viewerId);
    });

  const canViewFullPII = isOwner || isAdmin || isAttached;

  // Compute live expiry countdown and urgency level
  const { secondsToEffectiveExpiry, urgencyLevel } = computeCountdown(donation);
  donation.secondsToEffectiveExpiry = secondsToEffectiveExpiry;
  donation.urgencyLevel = urgencyLevel;

  // Compute distanceKm based on viewer location and privacy clearance
  if (viewerLocationOrDistance !== null && viewerLocationOrDistance !== undefined) {
    let viewerCoords = null;
    if (Array.isArray(viewerLocationOrDistance) && viewerLocationOrDistance.length === 2) {
      viewerCoords = viewerLocationOrDistance;
    } else if (viewerLocationOrDistance.coordinates && Array.isArray(viewerLocationOrDistance.coordinates)) {
      viewerCoords = viewerLocationOrDistance.coordinates;
    }

    if (viewerCoords && donation.location && Array.isArray(donation.location.coordinates)) {
      const [exactLng, exactLat] = donation.location.coordinates;
      if (canViewFullPII) {
        // Owner/admin/attached: exact distance rounded to 1 decimal
        const dist = calculateHaversineKm(viewerCoords, [exactLng, exactLat]);
        donation.distanceKm = Number(dist.toFixed(1));
      } else {
        // Non-attached: distance computed strictly from the ROUNDED coordinates, rounded to 1 decimal
        const roundedCoords = [Number(exactLng.toFixed(2)), Number(exactLat.toFixed(2))];
        const dist = calculateHaversineKm(viewerCoords, roundedCoords);
        donation.distanceKm = Number(dist.toFixed(1));
      }
    } else if (typeof viewerLocationOrDistance === 'number') {
      donation.distanceKm = Number(viewerLocationOrDistance.toFixed(1));
    }
  }

  // Handle donor field population safely
  if (donation.donorId && typeof donation.donorId === 'object' && donation.donorId.name) {
    const donorObj = donation.donorId;
    donation.donor = {
      _id: donorObj._id,
      name: donorObj.name,
      ratingAverage: donorObj.ratingAverage || 0,
      ratingCount: donorObj.ratingCount || 0,
      phone: canViewFullPII ? donorObj.phone : null,
    };
    donation.donorPhone = canViewFullPII ? donorObj.phone : null;
    if (!canViewFullPII) {
      donation.donorId.phone = null;
    }
  } else {
    donation.donorPhone = canViewFullPII ? donation.donorPhone || null : null;
  }

  // Format photos safely as [{ id, url }] (strips internal publicId)
  if (Array.isArray(donation.photos)) {
    donation.photos = donation.photos.map((p) => {
      if (typeof p === 'string') {
        return { id: p, url: p };
      }
      return {
        id: p.id || (p._id ? p._id.toString() : p.url),
        url: p.url,
      };
    });
  } else {
    donation.photos = [];
  }

  // Set area label on donation for all viewers
  const safeArea =
    donation.areaLabel ||
    (donation.address && donation.address.city && donation.address.state
      ? `${donation.address.city}, ${donation.address.state}`
      : donation.address?.city || 'Local Area');
  donation.areaLabel = safeArea;

  // Apply privacy redaction for general public / unattached viewers
  if (!canViewFullPII) {
    if (donation.address) {
      donation.address = {
        city: donation.address.city,
        state: donation.address.state || null,
        postalCode: donation.address.postalCode || null,
        area: safeArea,
        street: null, // Completely redacted
        formattedAddress: safeArea, // Safe area string only, NEVER original formattedAddress
      };
    } else {
      donation.address = {
        area: safeArea,
        street: null,
        formattedAddress: safeArea,
      };
    }

    if (donation.location && Array.isArray(donation.location.coordinates)) {
      const [lng, lat] = donation.location.coordinates;
      donation.location = {
        type: 'Point',
        coordinates: [Number(lng.toFixed(2)), Number(lat.toFixed(2))],
      };
    }
  }

  return donation;
};

module.exports = {
  toDonationView,
  calculateHaversineKm,
};
