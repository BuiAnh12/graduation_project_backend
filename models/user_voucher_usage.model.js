const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserVoucherUsageSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  voucherId: { type: Schema.Types.ObjectId, ref: 'vouchers', required: true },
  usedCount: { type: Number, default: 0 },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

UserVoucherUsageSchema.virtual('users', {
  ref: 'users',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

UserVoucherUsageSchema.virtual('vouchers', {
  ref: 'vouchers',
  localField: 'voucherId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('user_voucher_usage', UserVoucherUsageSchema);