const mongoose = require('mongoose');
const { Schema } = mongoose;

const InvoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'orders', required: true },
  issuedAt: { type: Date },
  pdfUrl: { type: String },
  subtotal: { type: Number },
  shippingFee: { type: Number },
  total: { type: Number },
  currency: { type: String },
  status: { type: String, enum: ['issued', 'cancelled', 'paid', 'refunded'] }, // issued | cancelled | paid | refunded

  orderSnapshot: { type: Schema.Types.Mixed },
}, {
  timestamps: true
});

InvoiceSchema.virtual('orders', {
  ref: 'orders',
  localField: 'orderId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('invoices', InvoiceSchema);
