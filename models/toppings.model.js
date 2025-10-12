const mongoose = require('mongoose');
const { Schema } = mongoose;

const ToppingSchema = new Schema({
  toppingGroupId: { type: Schema.Types.ObjectId, ref: 'topping_groups', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

ToppingSchema.virtual('topping_groups', {
  ref: 'topping_groups',
  localField: 'toppingGroupId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('toppings', ToppingSchema);