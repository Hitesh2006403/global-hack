const { z } = require('zod');
const { ROLES, PUBLIC_REGISTRATION_ROLES } = require('../constants/roles');

// Strict GeoJSON Point schema
const locationSchema = z
  .object({
    type: z.literal('Point').default('Point'),
    coordinates: z
      .tuple([
        z.number().min(-180).max(180), // Longitude
        z.number().min(-90).max(90),   // Latitude
      ]),
  })
  .strict();

// Strict address schema
const addressSchema = z
  .object({
    street: z.string().trim().optional(),
    city: z.string().trim().min(1, 'City is required'),
    state: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    formattedAddress: z.string().trim().min(1, 'Formatted address is required'),
  })
  .strict();

// Strict organization details schema
const organizationSchema = z
  .object({
    name: z.string().trim().optional(),
    regNo: z.string().trim().optional(),
    capacity: z.number().int().nonnegative().optional(),
  })
  .strict()
  .optional();

/**
 * Public User Registration Validation Schema
 * SECURITY: Strict whitelist. Admin role is forbidden. Unknown fields are rejected.
 */
const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[A-Za-z])(?=.*\d)/,
        'Password must contain at least one letter and one number'
      ),
    role: z.enum([ROLES.DONOR, ROLES.RECIPIENT, ROLES.DELIVERY_AGENT], {
      errorMap: () => ({
        message: 'Role must be one of: donor, recipient, delivery_agent (admin registration forbidden)',
      }),
    }),
    phone: z
      .string()
      .trim()
      .min(10, 'Phone number must be at least 10 digits')
      .max(15, 'Phone number cannot exceed 15 digits'),
    location: locationSchema,
    address: addressSchema,
    organization: organizationSchema,
  })
  .strict();

/**
 * User Login Validation Schema
 */
const loginSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

module.exports = {
  registerSchema,
  loginSchema,
};
