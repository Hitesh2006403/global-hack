const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../constants/roles');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned by default in queries
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: Object.values(ROLES),
        message: 'Role must be donor, recipient, delivery_agent, or admin',
      },
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: function () {
        // Donors and admins default to verified; recipients and delivery agents require admin verification
        return this.role === ROLES.DONOR || this.role === ROLES.ADMIN;
      },
    },
    isActive: {
      type: Boolean,
      default: true,
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
        required: [true, 'GeoJSON coordinates [longitude, latitude] are required'],
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
    organization: {
      name: { type: String, trim: true },
      regNo: { type: String, trim: true },
      capacity: { type: Number, min: 0 },
    },
    ratingAverage: {
      type: Number,
      default: 0.0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    googleId: { type: String, sparse: true, index: true },
    googleVerified: { type: Boolean, default: false },
    authProvider: { type: String, default: 'local' },
    avatar: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// Geospatial index on GeoJSON Point location
UserSchema.index({ location: '2dsphere' });

// Pre-save hook: Hash password with bcryptjs whenever modified
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
});

// Compare plaintext candidate password with hashed password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    throw new Error('Password field not selected in database query');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Ensure password and internal fields are never exposed in JSON serialization
UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
