const sharp = require('sharp');
const ApiError = require('./ApiError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Validates real file signature (magic bytes) to prevent extension spoofing.
 *
 * @param {Buffer} buffer - In-memory file buffer
 * @param {string} mimetype - Declared MIME type
 * @returns {boolean} True if magic bytes match declared image format
 */
const validateMagicBytes = (buffer, mimetype) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return false;
  }

  // 1. JPEG: FF D8 FF
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimetype === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // 3. WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (mimetype === 'image/webp') {
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    return riff === 'RIFF' && webp === 'WEBP';
  }

  return false;
};

/**
 * Sanitizes and re-encodes an image buffer:
 * 1. Enforces maximum dimensions (max 8000x8000) and limits input pixels to prevent decompression bombs.
 * 2. Rejects corrupted or non-decodable images.
 * 3. Auto-rotates image pixels based on EXIF orientation.
 * 4. Resizes to cap the longest edge at 1600 px without enlargement.
 * 5. Re-encodes as clean JPEG (or WebP), completely stripping all EXIF, GPS, camera metadata.
 *
 * @param {Buffer} buffer - Raw file buffer
 * @param {string} mimetype - Declared MIME type
 * @returns {Promise<{ buffer: Buffer, mimetype: string, extension: string }>} Cleaned buffer and details
 */
const processAndSanitizeImage = async (buffer, mimetype) => {
  const MAX_DIMENSION = 8000;
  const MAX_INPUT_PIXELS = MAX_DIMENSION * MAX_DIMENSION; // 64 million pixels

  let metadata;
  try {
    const probe = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'truncated' });
    metadata = await probe.metadata();
  } catch (err) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Invalid or corrupted image file. Image could not be decoded.'
    );
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_DIMENSION ||
    metadata.height > MAX_DIMENSION
  ) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `Image dimensions (${metadata.width}x${metadata.height}) exceed maximum allowed dimensions (${MAX_DIMENSION}x${MAX_DIMENSION}).`
    );
  }

  // Auto-rotate based on EXIF orientation tag before stripping
  let pipeline = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'truncated' })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    });

  let outputMime = 'image/jpeg';
  let outputExtension = '.jpg';

  if (mimetype === 'image/webp') {
    outputMime = 'image/webp';
    outputExtension = '.webp';
    pipeline = pipeline.webp({ quality: 80 });
  } else {
    outputMime = 'image/jpeg';
    outputExtension = '.jpg';
    pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
  }

  // Re-encode without EXIF/GPS metadata (sharp strips metadata by default unless .withMetadata() is specified)
  let cleanedBuffer;
  try {
    cleanedBuffer = await pipeline.toBuffer();
  } catch (err) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Failed to process and re-encode image.'
    );
  }

  return {
    buffer: cleanedBuffer,
    mimetype: outputMime,
    extension: outputExtension,
  };
};

module.exports = {
  validateMagicBytes,
  processAndSanitizeImage,
};
