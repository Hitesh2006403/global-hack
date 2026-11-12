const mongoose = require('mongoose');
const crypto = require('crypto');
const { DONATION_STATUS } = require('../constants/status');
const AcceptanceSchema = require('./Acceptance');

const StatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const PhotoSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => crypto.randomUUID(),
    },
    url: {
      type: String,
      required: [true, 'Photo URL is required'],
      trim: true,
    },
    publicId: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const DonationSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor ID is required'],
      index: true,
    },
    foodName: {
      type: String,
      required: [true, 'Food name is required'],
      trim: true,
      minlength: [3, 'Food name must be at least 3 characters'],
      maxlength: [120, 'Food name cannot exceed 120 characters'],
    },
    foodType: {
      type: String,
      required: [true, 'Food type is required'],
      enum: {
        values: ['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items'],
        message: 'Invalid food type category',
      },
    },
    dietaryType: {
      type: String,
      required: [true, 'Dietary type is required'],
      enum: {
        values: ['vegetarian', 'non_vegetarian', 'vegan'],
        message: 'Invalid dietary type',
      },
    },
    totalQuantity: {
      type: Number,
      required: [true, 'Total quantity is required'],
      min: [1, 'Total quantity must be at least 1'],
    },
    remainingQuantity: {
      type: Number,
      required: [true, 'Remaining quantity is required'],
      min: [0, 'Remaining quantity cannot be negative'],
    },
    unit: {
      type: String,
      required: [true, 'Unit of measurement is required'],
      enum: {
        values: ['plates', 'kg', 'packets', 'servings'],
        message: 'Invalid unit of measurement',
      },
    },
    cookedAt: {
      type: Date,
      required: [true, 'Cooked timestamp is required'],
    },
    expiryAt: {
      type: Date,
      required: [true, 'Expiry timestamp is required'],
    },
    safetyBufferMinutes: {
      type: Number,
      default: 60,
      min: [15, 'Safety buffer must be at least 15 minutes'],
      max: [240, 'Safety buffer cannot exceed 240 minutes'],
    },
    pickupWindowStart: {
      type: Date,
      required: [true, 'Pickup window start time is required'],
    },
    pickupWindowEnd: {
      type: Date,
      required: [true, 'Pickup window end time is required'],
    },
    packagingType: {
      type: String,
      enum: ['sealed_containers', 'loose_packets', 'bulk_vessel'],
      default: 'sealed_containers',
    },
    instructions: {
      type: String,
      maxlength: [500, 'Instructions cannot exceed 500 characters'],
      trim: true,
      default: null,
    },
    photos: {
      type: [PhotoSchema],
      set: function (val) {
        if (!Array.isArray(val)) return val;
        return val.map((p) => {
          if (typeof p === 'string') {
            return { id: crypto.randomUUID(), url: p, publicId: null };
          }
          if (p && typeof p === 'object' && !p.id) {
            return {
              id: crypto.randomUUID(),
              url: p.url,
              publicId: p.publicId || null,
            };
          }
          return p;
        });
      },
      validate: [
        (val) => val.length <= 5,
        'Cannot upload more than 5 photos per donation',
      ],
      default: [],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Coordinates [longitude, latitude] are required'],
      },
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      formattedAddress: {
        type: String,
        required: [true, 'Formatted address is required'],
        trim: true,
      },
    },
    areaLabel: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(DONATION_STATUS),
        message: 'Invalid donation status',
      },
      default: DONATION_STATUS.AVAILABLE,
      required: true,
    },
    acceptances: [AcceptanceSchema],
    statusHistory: [StatusHistorySchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Transform strings or loose objects to standard PhotoSchema shape before validation
DonationSchema.pre('validate', function () {
  if (Array.isArray(this.photos)) {
    this.photos = this.photos.map((p) => {
      if (typeof p === 'string') {
        return { id: crypto.randomUUID(), url: p, publicId: null };
      }
      if (p && typeof p === 'object' && !p.id) {
        return {
          id: crypto.randomUUID(),
          url: p.url,
          publicId: p.publicId || null,
        };
      }
      return p;
    });
  }
});

// Indexes
DonationSchema.index({ location: '2dsphere' });
DonationSchema.index({ status: 1, expiryAt: 1 });

// Virtual: Effective Expiry Timestamp (expiryAt minus safety buffer in ms)
DonationSchema.virtual('effectiveExpiryAt').get(function () {
  if (!this.expiryAt) return null;
  const bufferMs = (this.safetyBufferMinutes || 60) * 60000;
  return new Date(this.expiryAt.getTime() - bufferMs);
});

const Donation = mongoose.model('Donation', DonationSchema);

module.exports = Donation;
