const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { validateMagicBytes, processAndSanitizeImage } = require('../utils/imageProcessor');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Local Disk Storage Adapter.
 * Default for development and local testing.
 */
class LocalStorageAdapter {
  constructor(uploadsDir = UPLOADS_DIR) {
    this.uploadsDir = uploadsDir;
  }

  /**
   * Sanitizes, auto-rotates, caps size at 1600px, strips EXIF/GPS metadata,
   * and saves to local disk with a UUID filename.
   *
   * @param {Object} file - { buffer, originalname, mimetype }
   * @returns {Promise<{ id: string, url: string, publicId: string }>}
   */
  async saveFile({ buffer, originalname, mimetype }) {
    if (!validateMagicBytes(buffer, mimetype)) {
      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid file content signature. File magic bytes do not match declared image format.'
      );
    }

    // Re-encode, auto-rotate, limit dimensions, and strip all EXIF/GPS tags
    const { buffer: cleanBuffer, extension } = await processAndSanitizeImage(
      buffer,
      mimetype
    );

    // Random cryptographically secure filename
    const safeRandomFilename = `${crypto.randomUUID()}${extension}`;
    const targetPath = path.join(this.uploadsDir, safeRandomFilename);

    await fs.promises.writeFile(targetPath, cleanBuffer);

    const fileUrl = `/uploads/${safeRandomFilename}`;
    const result = {
      id: crypto.randomUUID(),
      url: fileUrl,
      publicId: safeRandomFilename,
      toString() {
        return this.url;
      },
    };

    return result;
  }

  /**
   * Deletes a file from the local filesystem.
   *
   * @param {string} fileUrl
   * @param {string} [publicId]
   * @returns {Promise<void>}
   */
  async deleteFile(fileUrl, publicId) {
    const filename = publicId || (fileUrl ? path.basename(fileUrl) : null);
    if (!filename) return;
    const targetPath = path.join(this.uploadsDir, filename);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath).catch(() => {});
    }
  }

  getUploadsDirectory() {
    return this.uploadsDir;
  }
}

/**
 * Factory function to instantiate the active storage adapter
 * based on process.env.STORAGE_PROVIDER ('local' or 'cloudinary').
 */
const getStorageService = () => {
  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  if (provider === 'cloudinary') {
    const { CloudinaryStorageAdapter } = require('./cloudinaryStorageAdapter');
    return new CloudinaryStorageAdapter();
  }
  return new LocalStorageAdapter();
};

const storageService = getStorageService();

module.exports = {
  storageService,
  LocalStorageAdapter,
  getStorageService,
  validateMagicBytes,
  processAndSanitizeImage,
};
