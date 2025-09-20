const mongoose = require('mongoose');
const { Schema } = mongoose;

const CartItemSchema = new Schema({
  cartId: { type: Schema.Types.ObjectId, ref: 'carts', required: true },
  participantId: { type: Schema.Types.ObjectId, ref: 'cart_participants', required: true },

  dishId: { type: Schema.Types.ObjectId, ref: 'dishes', required: true },
  dishName: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  note: { type: String },
  lineTotal: { type: Number }, // price*qty + toppings
}, {
  timestamps: true
});

CartItemSchema.virtual('carts', {
  ref: 'carts',
  localField: 'cartId',
  foreignField: '_id',
  justOne: true
});

CartItemSchema.virtual('cart_participants', {
  ref: 'cart_participants',
  localField: 'participantId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('cart_items', CartItemSchema);
