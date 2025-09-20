const mongoose = require('mongoose');
const { Schema } = mongoose;

const ToppingGroupSchema = new Schema({
  name: { type: String, required: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'stores', required: true },
  onlyOnce: { type: Boolean, default: false },
}, {
  timestamps: true
});

ToppingGroupSchema.virtual('stores', {
  ref: 'stores',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('topping_groups', ToppingGroupSchema);
