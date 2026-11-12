const multer = require('multer');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB per file

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          `Invalid file type '${file.mimetype}'. Only image/jpeg, image/png, and image/webp are allowed.`
        )
      );
    }
  },
});

module.exports = upload;
