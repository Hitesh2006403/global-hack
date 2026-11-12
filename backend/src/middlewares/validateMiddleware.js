const { ZodError } = require('zod');

/**
 * Express middleware for request schema validation using Zod.
 * EXPRESS 5 COMPATIBILITY: req.query and req.params are getters in Express 5 and cannot be reassigned.
 * Validated and sanitized outputs are stored in `req.validated = { body, query, params }`.
 * `req.body` is also updated with the sanitized body payload.
 *
 * @param {Object} schema - Validation schema configuration ({ body, query, params } or direct schema)
 * @returns {Function} Express middleware function
 */
const validate = (schema) => (req, res, next) => {
  try {
    req.validated = {
      body: req.body,
      query: req.query,
      params: req.params,
    };

    if (!schema) {
      return next();
    }

    // Object containing body, query, and/or params schemas
    if (schema.body) {
      const parsedBody = schema.body.parse(req.body);
      req.validated.body = parsedBody;
      req.body = parsedBody;
    }

    if (schema.query) {
      // Safely parse query without reassigning read-only req.query
      req.validated.query = schema.query.parse(req.query);
    }

    if (schema.params) {
      // Safely parse params without reassigning read-only req.params
      req.validated.params = schema.params.parse(req.params);
    }

    // Direct single schema (validates body by default)
    if (!schema.body && !schema.query && !schema.params && typeof schema.parse === 'function') {
      const parsedBody = schema.parse(req.body);
      req.validated.body = parsedBody;
      req.body = parsedBody;
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = validate;
