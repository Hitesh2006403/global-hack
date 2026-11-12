const { z } = require('zod');

// GeoJSON Point schema
const locationSchema = z
  .object({
    type: z.literal('Point').default('Point'),
    coordinates: z.tuple([
      z.number().min(-180).max(180), // Longitude
      z.number().min(-90).max(90),   // Latitude
    ]),
  })
  .strict();

// Address schema
const addressSchema = z
  .object({
    street: z.string().trim().optional(),
    city: z.string().trim().min(1, 'City is required'),
    state: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    formattedAddress: z.string().trim().min(1, 'Formatted address is required'),
  })
  .strict();

/**
 * Create Donation Validation Schema.
 * SECURITY: Strict whitelist (.strict()).
 * Client CANNOT supply status, remainingQuantity, donorId, statusHistory, or acceptances.
 */
const createDonationSchema = z
  .object({
    foodName: z.string().trim().min(3, 'Food name must be at least 3 characters').max(120),
    foodType: z.enum(['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items']),
    dietaryType: z.enum(['vegetarian', 'non_vegetarian', 'vegan']),
    totalQuantity: z.number().int('Quantity must be an integer').positive('Quantity must be greater than 0'),
    unit: z.enum(['plates', 'kg', 'packets', 'servings']),
    cookedAt: z.coerce.date(),
    expiryAt: z.coerce.date(),
    safetyBufferMinutes: z.number().int().min(15).max(240).default(60),
    pickupWindowStart: z.coerce.date(),
    pickupWindowEnd: z.coerce.date(),
    packagingType: z.enum(['sealed_containers', 'loose_packets', 'bulk_vessel']).optional().default('sealed_containers'),
    instructions: z.string().trim().max(500).optional(),
    photos: z
      .array(
        z.union([
          z.string().trim().min(1),
          z.object({
            id: z.string().optional(),
            url: z.string().trim().min(1),
          }),
        ])
      )
      .max(5, 'Maximum 5 photos allowed')
      .optional()
      .default([]),
    location: locationSchema,
    address: addressSchema,
    areaLabel: z.string().trim().max(100).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const now = new Date();
    const toleranceMs = 2 * 60 * 1000; // 2-minute clock skew tolerance

    // 1. cookedAt <= now (with 2-minute tolerance)
    if (data.cookedAt.getTime() > now.getTime() + toleranceMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cooked time cannot be in the future',
        path: ['cookedAt'],
      });
    }

    // 2. expiryAt > cookedAt
    if (data.expiryAt.getTime() <= data.cookedAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expiry time must be strictly after cooked time',
        path: ['expiryAt'],
      });
    }

    // 3. effectiveExpiryAt = expiryAt - safetyBuffer > now
    const effectiveExpiryMs = data.expiryAt.getTime() - data.safetyBufferMinutes * 60000;
    if (effectiveExpiryMs <= now.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Effective expiry time (expiry minus safety buffer) must be in the future',
        path: ['expiryAt'],
      });
    }

    // 4. pickupWindowStart >= now (with 2-minute tolerance)
    if (data.pickupWindowStart.getTime() < now.getTime() - toleranceMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pickup window start time cannot be in the past',
        path: ['pickupWindowStart'],
      });
    }

    // 5. pickupWindowEnd > pickupWindowStart and <= effectiveExpiryAt
    if (data.pickupWindowEnd.getTime() <= data.pickupWindowStart.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pickup window end time must be after pickup window start time',
        path: ['pickupWindowEnd'],
      });
    }

    if (data.pickupWindowEnd.getTime() > effectiveExpiryMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pickup window end time cannot exceed effective expiry deadline',
        path: ['pickupWindowEnd'],
      });
    }
  });

/**
 * Update Donation Validation Schema.
 * Permitted only when donation is AVAILABLE and has 0 acceptances.
 */
const updateDonationSchema = z
  .object({
    foodName: z.string().trim().min(3).max(120).optional(),
    packagingType: z.enum(['sealed_containers', 'loose_packets', 'bulk_vessel']).optional(),
    instructions: z.string().trim().max(500).optional(),
    pickupWindowEnd: z.coerce.date().optional(),
    photos: z
      .array(
        z.union([
          z.string().trim().min(1),
          z.object({
            id: z.string().optional(),
            url: z.string().trim().min(1),
          }),
        ])
      )
      .max(5)
      .optional(),
    areaLabel: z.string().trim().max(100).optional(),
  })
  .strict();

/**
 * Cancel Donation Validation Schema.
 */
const cancelDonationSchema = z
  .object({
    reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
  })
  .strict();

module.exports = {
  createDonationSchema,
  updateDonationSchema,
  cancelDonationSchema,
};
