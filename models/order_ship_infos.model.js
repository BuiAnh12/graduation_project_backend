const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderShipInfoSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'orders', required: true },
  shipLocation: { type: Schema.Types.Mixed }, // GeoJSON Point [lng, lat]
  address: { type: String },
  detailAddress: { type: String },
  contactName: { type: String },
  contactPhonenumber: { type: String },
  note: { type: String },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

OrderShipInfoSchema.virtual('orders', {
  ref: 'orders',
  localField: 'orderId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('order_ship_infos', OrderShipInfoSchema);