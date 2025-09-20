const mongoose = require('mongoose');
const { Schema } = mongoose;

const CartActivitySchema = new Schema({
  cartId: { type: Schema.Types.ObjectId },
  participantId: { type: Schema.Types.ObjectId },
  action: { type: String, enum: ['add_item', 'remove_item', 'join', 'leave'] },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false
});

module.exports = mongoose.model('cart_activities', CartActivitySchema);
    