const mongoose = require('mongoose');
const { Schema } = mongoose;

const LocationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'users' },
  name: { type: String },
  address: { type: String },
  location: { type: Schema.Types.Mixed }, // GeoJSON Point {type, coordinates}
  detailAddress: { type: String },
  contactName: { type: String },
  contactPhonenumber: { type: String },
  note: { type: String },
  type: { type: String, enum: ['home', 'company', 'familiar'] },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

LocationSchema.virtual('users', {
  ref: 'users',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('locations', LocationSchema);