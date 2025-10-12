const mongoose = require('mongoose');
const { Schema } = mongoose;

const CartVoucherSchema = new Schema({
  cartId: { type: Schema.Types.ObjectId, ref: 'carts', required: true },
  voucherId: { type: Schema.Types.ObjectId, ref: 'vouchers', required: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

CartVoucherSchema.virtual('carts', {
  ref: 'carts',
  localField: 'cartId',
  foreignField: '_id',
  justOne: true
});

CartVoucherSchema.virtual('vouchers', {
  ref: 'vouchers',
  localField: 'voucherId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('cart_vouchers', CartVoucherSchema);