const mongoose = require('mongoose');
const { Schema } = mongoose;

const CartParticipantSchema = new Schema({
  cartId: { type: Schema.Types.ObjectId, ref: 'carts' },
  userId: { type: Schema.Types.ObjectId, ref: 'users' },
  isOwner: { type: Boolean, default: false },

  joinedAt: { type: Date },
  status: { type: String, default: 'active' , enum: ['active', 'removed']},
}, {
  timestamps: false
});

CartParticipantSchema.virtual('carts', {
  ref: 'carts',
  localField: 'cartId',
  foreignField: '_id',
  justOne: true
});

CartParticipantSchema.virtual('users', {
  ref: 'users',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('cart_participants', CartParticipantSchema);
