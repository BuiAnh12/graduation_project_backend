const mongoose = require('mongoose');
const { Schema } = mongoose;

const CartItemToppingSchema = new Schema({
  cartItemId: { type: Schema.Types.ObjectId, ref: 'cart_items', required: true },
  toppingId: { type: Schema.Types.ObjectId, ref: 'toppings', required: true },
  toppingName: { type: String, required: true },
  price: { type: Number, required: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

CartItemToppingSchema.virtual('cart_items', {
  ref: 'cart_items',
  localField: 'cartItemId',
  foreignField: '_id',
  justOne: true
});

CartItemToppingSchema.virtual('toppings', {
  ref: 'toppings',
  localField: 'toppingId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('cart_item_toppings', CartItemToppingSchema);