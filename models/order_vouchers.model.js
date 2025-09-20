const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderVoucherSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'orders', required: true },
  voucherId: { type: Schema.Types.ObjectId, ref: 'vouchers', required: true },
  voucherCode: { type: String },
  discountAmount: { type: Number, required: true },
  voucherSnapshot: { type: Schema.Types.Mixed }, // snapshot JSON
}, {
  timestamps: true
});

OrderVoucherSchema.virtual('orders', {
  ref: 'orders',
  localField: 'orderId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('order_vouchers', OrderVoucherSchema);
