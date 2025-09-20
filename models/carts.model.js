const mongoose = require('mongoose');
const { Schema } = mongoose;

const CartSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'stores', required: true },
  location: { type: Schema.Types.ObjectId, ref: 'locations' },
  paymentMethod: { type: String },
  shippingFee: { type: Number },

  mode: { type: String, default: 'private', enum: ['private', 'public'] },
  privateToken: { type: String },

  expiryAt: { type: Date },
  status: { type: String, default: 'active', enum: ['active', 'expired', 'finalized']}, 
  completed: { type: Boolean, default: false },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

CartSchema.virtual('users', {
  ref: 'users',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

CartSchema.virtual('stores', {
  ref: 'stores',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('carts', CartSchema);
