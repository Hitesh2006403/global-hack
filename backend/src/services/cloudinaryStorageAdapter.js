const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { processAndSanitizeImage, validateMagicBytes } = require('../utils/imageProcessor');

/**
 * Cloudinary Storage Adapter.
 * Provides production-ready persistent image storage on Cloudinary CDN.
 */
class CloudinaryStorageAdapter {
  constructor(config = {}) {
    this.cloudName = config.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
    this.apiKey = config.apiKey || process.env.CLOUDINARY_API_KEY;
    this.apiSecret = config.apiSecret || process.env.CLOUDINARY_API_SECRET;

    if (
      !this.cloudName ||
      !this.apiKey ||
      !this.apiSecret ||
      this.cloudName.toLowerCase().includes('change-me') ||
      this.apiKey.toLowerCase().includes('change-me') ||
      this.apiSecret.toLowerCase().includes('change-me')
    ) {
      throw new Error(
        '[Storage Fatal] Cloudinary configuration error: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be configured with real credentials when STORAGE_PROVIDER=cloudinary.'
      );
    }

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
  }

  /**
   * Strips EXIF/GPS metadata, auto-rotates, resizes to <=1600px, and streams buffer to Cloudinary.
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

    const { buffer: cleanBuffer, mimetype: cleanMime } = await processAndSanitizeImage(
      buffer,
      mimetype
    );

    const safePublicId = `donation_${crypto.randomUUID()}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'shareaplate/donations',
          public_id: safePublicId,
          resource_type: 'image',
          format: cleanMime === 'image/webp' ? 'webp' : 'jpg',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(cleanBuffer);
    });

    const secureUrl = uploadResult.secure_url || uploadResult.url;
    const finalPublicId = uploadResult.public_id || safePublicId;

    return {
      id: crypto.randomUUID(),
      url: secureUrl,
      publicId: finalPublicId,
    };
  }

  /**
   * Deletes a remote asset from Cloudinary using publicId.
   *
   * @param {string} fileUrl
   * @param {string} [publicId]
   * @returns {Promise<void>}
   */
  async deleteFile(fileUrl, publicId) {
    let targetPublicId = publicId;
    if (!targetPublicId && fileUrl) {
      const match = fileUrl.match(/(?:v\d+\/)?(shareaplate\/donations\/[^\.]+)/);
      if (match) {
        targetPublicId = match[1];
      }
    }

    if (targetPublicId) {
      await cloudinary.uploader.destroy(targetPublicId).catch((err) => {
        console.error(`[Cloudinary Warning] Failed to delete image ${targetPublicId}: ${err.message}`);
      });
    }
  }
}

module.exports = {
  CloudinaryStorageAdapter,
};
