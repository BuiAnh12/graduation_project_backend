const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderItemToppingSchema = new Schema({
  orderItemId: { type: Schema.Types.ObjectId, ref: 'order_items', required: true },
  toppingId: { type: Schema.Types.ObjectId, ref: 'toppings', required: true },
  toppingName: { type: String, required: true },
  price: { type: Number, required: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

OrderItemToppingSchema.virtual('order_items', {
  ref: 'order_items',
  localField: 'orderItemId',
  foreignField: '_id',
  justOne: true
});

OrderItemToppingSchema.virtual('toppings', {
  ref: 'toppings',
  localField: 'toppingId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('order_item_toppings', OrderItemToppingSchema);