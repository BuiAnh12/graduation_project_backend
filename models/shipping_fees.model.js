const mongoose = require('mongoose');
const { Schema } = mongoose;

const ShippingFeeSchema = new Schema({
  fromDistance: { type: Number },
  feePerKm: { type: Number },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index suggestion: (store, fromDistance) unique
ShippingFeeSchema.index({ fromDistance: 1 }, { unique: true });

module.exports = mongoose.model('shipping_fees', ShippingFeeSchema);