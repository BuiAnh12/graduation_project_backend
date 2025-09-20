const mongoose = require('mongoose');
const { Schema } = mongoose;

const StoreSchema = new Schema({
  name: { type: String, required: true, unique: true },
  owner: { type: Schema.Types.ObjectId, ref: 'staffs', required: true },
  description: { type: String },

  // GeoJSON
  location: { type: Schema.Types.Mixed }, // expected: { type: "Point", coordinates: [lng, lat] }
  address_full: { type: String },

  systemCategoryId: [{ type: Schema.Types.ObjectId, ref: 'system_categories' }],

  avatarImage: { type: Schema.Types.ObjectId, ref: 'images' },
  coverImage: { type: Schema.Types.ObjectId, ref: 'images' },

  status: { type: String, default: 'approved' , enum: ['approved', 'register', 'blocked']}, 
  openStatus: { type: String, default: 'opened' , enum: ['opened', 'closed']}, 
  openHour: { type: String, default: '08:00' },
  closeHour: { type: String, default: '18:00' },

  ICFrontImage: { type: Schema.Types.ObjectId, ref: 'images' },
  ICBackImage: { type: Schema.Types.ObjectId, ref: 'images' },
  BusinessLicenseImage: { type: Schema.Types.ObjectId, ref: 'images' },

  staff: [{ type: Schema.Types.ObjectId, ref: 'staffs' }],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
StoreSchema.virtual('staffs', {
  ref: 'staffs',
  localField: 'staff',
  foreignField: '_id',
  justOne: false
});

StoreSchema.virtual('system_categories', {
  ref: 'system_categories',
  localField: 'systemCategoryId',
  foreignField: '_id',
  justOne: false
});

module.exports = mongoose.model('stores', StoreSchema);
