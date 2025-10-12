const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderItemSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'orders', required: true },
  dishId: { type: Schema.Types.ObjectId, ref: 'dishes', required: true },
  dishName: { type: String, required: true },
  unit: { type: String },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  toppingsTotal: { type: Number },
  lineSubtotal: { type: Number }, // price*quantity
  lineTotal: { type: Number }, // lineSubtotal + toppingsTotal
  note: { type: String },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

OrderItemSchema.virtual('orders', {
  ref: 'orders',
  localField: 'orderId',
  foreignField: '_id',
  justOne: true
});

OrderItemSchema.virtual('dishes', {
  ref: 'dishes',
  localField: 'dishId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('order_items', OrderItemSchema);