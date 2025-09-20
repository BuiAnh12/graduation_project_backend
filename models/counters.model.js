const mongoose = require('mongoose');
const { Schema } = mongoose;

const CounterSchema = new Schema({
  _id: { type: String, required: true }, // e.g. 'invoice' or 'order'
  type: { type: String , enum: ['order', 'invoice']},
  date: { type: Date },
  storeId: { type: Schema.Types.ObjectId },
  seq: { type: Number }
}, {
  timestamps: false
});

module.exports = mongoose.model('counters', CounterSchema);
