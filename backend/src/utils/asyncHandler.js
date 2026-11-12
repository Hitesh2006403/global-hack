/**
 * Wraps an async route handler or middleware to catch rejected promises
 * and pass the error to Express next() without repetitive try/catch blocks.
 *
 * @param {Function} fn - Async route handler function (req, res, next)
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
