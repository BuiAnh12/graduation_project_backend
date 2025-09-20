const mongoose = require('mongoose');
const { Schema } = mongoose;

const UVUSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  voucherId: { type: Schema.Types.ObjectId, ref: 'vouchers', required: true },
  usedCount: { type: Number, default: 0 },
}, {
  timestamps: true
});

UVUSchema.virtual('users', {
  ref: 'users',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

UVUSchema.virtual('vouchers', {
  ref: 'vouchers',
  localField: 'voucherId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('user_voucher_usage', UVUSchema);
