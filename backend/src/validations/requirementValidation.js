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
 * Recipient Requirement Creation Schema.
 */
const createRequirementSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
    foodType: z.enum(['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items']),
    quantityNeeded: z.number().int().positive('Quantity must be greater than 0'),
    unit: z.enum(['plates', 'kg', 'packets', 'servings']),
    dietaryPreference: z.enum(['vegetarian', 'non_vegetarian', 'vegan', 'any']).default('any'),
    neededBy: z.coerce.date(),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
    location: locationSchema,
    address: addressSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const now = new Date();
    if (data.neededBy.getTime() <= now.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Deadline (neededBy) must be in the future',
        path: ['neededBy'],
      });
    }
  });

const { REQUIREMENT_STATUS } = require('../constants/status');

/**
 * Filter / Query Schema for requirements listing
 */
const filterRequirementSchema = z
  .object({
    status: z.enum(Object.values(REQUIREMENT_STATUS)).optional(),
    foodType: z.enum(['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items']).optional(),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict();

module.exports = {
  createRequirementSchema,
  filterRequirementSchema,
};
