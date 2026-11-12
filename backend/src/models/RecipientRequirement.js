const mongoose = require('mongoose');
const { REQUIREMENT_STATUS } = require('../constants/status');

const RecipientRequirementSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Requirement title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    foodType: {
      type: String,
      required: [true, 'Food type is required'],
      enum: {
        values: ['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items'],
        message: 'Invalid food type category',
      },
    },
    quantityNeeded: {
      type: Number,
      required: [true, 'Quantity needed is required'],
      min: [1, 'Quantity needed must be at least 1'],
    },
    unit: {
      type: String,
      required: [true, 'Unit of measurement is required'],
      enum: {
        values: ['plates', 'kg', 'packets', 'servings'],
        message: 'Invalid unit of measurement',
      },
    },
    dietaryPreference: {
      type: String,
      enum: ['vegetarian', 'non_vegetarian', 'vegan', 'any'],
      default: 'any',
    },
    neededBy: {
      type: Date,
      required: [true, 'Needed by deadline is required'],
    },
    urgency: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: 'Invalid urgency level',
      },
      default: 'MEDIUM',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
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
    status: {
      type: String,
      enum: {
        values: Object.values(REQUIREMENT_STATUS),
        message: 'Invalid requirement status',
      },
      default: REQUIREMENT_STATUS.OPEN,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

RecipientRequirementSchema.index({ location: '2dsphere' });
RecipientRequirementSchema.index({ status: 1, neededBy: 1 });

const RecipientRequirement = mongoose.model(
  'RecipientRequirement',
  RecipientRequirementSchema
);

module.exports = RecipientRequirement;
