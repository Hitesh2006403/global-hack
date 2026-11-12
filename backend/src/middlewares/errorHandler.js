const { ZodError } = require('zod');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Global Express Error Handling Middleware.
 * Standardizes all application, Mongoose, Zod, and JWT errors into the team JSON error envelope.
 *
 * SECURITY: Hides stack traces unless NODE_ENV === 'development'. Never logs secrets or passwords.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.errorCode || ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = err.message || 'An unexpected error occurred on the server';
  let details = err.details || null;

  // 1. Body Parser Malformed JSON SyntaxError
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    statusCode = 400;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = 'Malformed JSON payload in request body';
    details = [{ field: 'body', issue: 'Invalid JSON syntax' }];
  }

  // 2. Body Parser Payload Too Large (exceeds 10kb limit)
  else if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    statusCode = 413;
    errorCode = ERROR_CODES.PAYLOAD_TOO_LARGE;
    message = 'Request payload exceeds size limit';
    details = [{ field: 'body', issue: 'Payload exceeds maximum allowed size' }];
  }

  // 3. Multer Upload Errors
  else if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      errorCode = ERROR_CODES.PAYLOAD_TOO_LARGE;
      message = 'Uploaded file exceeds the 2 MB size limit';
      details = [{ field: 'photos', issue: 'File size must not exceed 2 MB' }];
    } else {
      statusCode = 400;
      errorCode = ERROR_CODES.VALIDATION_ERROR;
      message = err.message || 'File upload validation error';
      details = [{ field: 'photos', issue: err.message }];
    }
  }

  // 3. Zod Schema Validation Error
  else if (err instanceof ZodError || err.name === 'ZodError') {
    statusCode = 400;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = 'Validation failed';
    details = (err.issues || err.errors || []).map((issue) => ({
      field: issue.path.join('.'),
      issue: issue.message,
    }));
  }

  // 2. Mongoose Schema Validation Error
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = 'Database validation failed';
    details = Object.keys(err.errors || {}).map((field) => ({
      field,
      issue: err.errors[field].message,
    }));
  }

  // 3. Mongoose CastError (Invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = ERROR_CODES.INVALID_ID;
    message = `Invalid identifier format for field '${err.path}'`;
    details = [
      {
        field: err.path,
        issue: `Expected valid ObjectId, received: ${err.value}`,
      },
    ];
  }

  // 4. MongoDB Duplicate Key Error (Code 11000)
  else if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
    statusCode = 409;
    errorCode = ERROR_CODES.CONFLICT;
    const duplicatedField = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    message = `A record with this ${duplicatedField} already exists`;
    details = [
      {
        field: duplicatedField,
        issue: 'Value must be unique',
      },
    ];
  }

  // 5. JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = ERROR_CODES.UNAUTHORIZED;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = ERROR_CODES.UNAUTHORIZED;
    message = 'Authentication token has expired';
  }

  // Construct standard error envelope
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      details,
    },
  };

  // Attach stack trace only in development mode for non-production debugging
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
