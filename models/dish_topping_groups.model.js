const mongoose = require('mongoose');
const { Schema } = mongoose;

const DishToppingGroupSchema = new Schema({
  dishId: { type: Schema.Types.ObjectId, ref: 'dishes' },
  toppingGroupId: { type: Schema.Types.ObjectId, ref: 'topping_groups' },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

DishToppingGroupSchema.virtual('dishes', {
  ref: 'dishes',
  localField: 'dishId',
  foreignField: '_id',
  justOne: true
});

DishToppingGroupSchema.virtual('topping_groups', {
  ref: 'topping_groups',
  localField: 'toppingGroupId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('dish_topping_groups', DishToppingGroupSchema);