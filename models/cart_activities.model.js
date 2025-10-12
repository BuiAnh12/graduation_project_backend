const mongoose = require('mongoose');
const { Schema } = mongoose;

const CartActivitySchema = new Schema({
  cartId: { type: Schema.Types.ObjectId },
  participantId: { type: Schema.Types.ObjectId },
  action: { type: String, enum: ['add_item', 'remove_item', 'join', 'leave'] },
  ip: { type: String },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

CartActivitySchema.virtual('carts', {
  ref: 'carts',
  localField: 'cartId',
  foreignField: '_id',
  justOne: true
});

CartActivitySchema.virtual('cart_participants', {
  ref: 'cart_participants',
  localField: 'participantId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('cart_activities', CartActivitySchema);