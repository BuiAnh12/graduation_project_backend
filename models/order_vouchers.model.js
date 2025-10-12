const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderVoucherSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'orders', required: true },
  voucherId: { type: Schema.Types.ObjectId, ref: 'vouchers', required: true },
  voucherCode: { type: String },
  discountAmount: { type: Number, required: true },
  voucherSnapshot: { type: Schema.Types.Mixed }, // JSON snapshot of voucher at time of use
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

OrderVoucherSchema.virtual('orders', {
  ref: 'orders',
  localField: 'orderId',
  foreignField: '_id',
  justOne: true
});

OrderVoucherSchema.virtual('vouchers', {
  ref: 'vouchers',
  localField: 'voucherId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('order_vouchers', OrderVoucherSchema);