const mongoose = require('mongoose');
const { Schema } = mongoose;

const PaymentSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'orders', required: true },
  provider: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  status: { type: String, default: 'pending' },
  transactionId: { type: String, unique: true, sparse: true },
  providerWebhookId: { type: String },
  metadata: { type: Schema.Types.Mixed },
  idempotencyKey: { type: String },
}, {
  timestamps: true
});

PaymentSchema.virtual('orders', {
  ref: 'orders',
  localField: 'orderId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('payments', PaymentSchema);
