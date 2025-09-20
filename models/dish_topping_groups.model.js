const mongoose = require('mongoose');
const { Schema } = mongoose;

const DishToppingGroupSchema = new Schema({
  dishId: { type: Schema.Types.ObjectId, ref: 'dishes' },
  toppingGroupId: { type: Schema.Types.ObjectId, ref: 'topping_groups' }
}, {
  timestamps: false
});

// This is a join collection. No timestamps by default in original schema.

module.exports = mongoose.model('dish_topping_groups', DishToppingGroupSchema);
