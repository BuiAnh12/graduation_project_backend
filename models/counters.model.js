const mongoose = require('mongoose');
const { Schema } = mongoose;

const CounterSchema = new Schema({
  _id: { type: String, required: true }, // e.g. 'invoice' or 'order'
  type: { type: String , enum: ['order', 'invoice']},
  date: { type: Date },
  storeId: { type: Schema.Types.ObjectId, ref: 'stores' },
  seq: { type: Number },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

CounterSchema.virtual('stores', {
  ref: 'stores',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('counters', CounterSchema);