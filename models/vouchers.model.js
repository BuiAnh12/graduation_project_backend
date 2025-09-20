const mongoose = require('mongoose');
const { Schema } = mongoose;

const VoucherSchema = new Schema({
  storeId: { type: Schema.Types.ObjectId, ref: 'stores', required: true },
  code: { type: String, required: true },
  description: { type: String },
  discountType: { type: String, required: true }, // PERCENTAGE | FIXED
  discountValue: { type: Number, required: true },
  maxDiscount: { type: Number },
  minOrderAmount: { type: Number },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  usageLimit: { type: Number },
  usedCount: { type: Number, default: 0 },
  userLimit: { type: Number },
  isActive: { type: Boolean, default: true },
  isStackable: { type: Boolean, default: false },
  type: { type: String, default: 'FOOD' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index suggestion: unique per store + code
VoucherSchema.index({ storeId: 1, code: 1 }, { unique: true });

VoucherSchema.virtual('stores', {
  ref: 'stores',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('vouchers', VoucherSchema);
