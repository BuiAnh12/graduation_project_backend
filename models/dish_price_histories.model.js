const mongoose = require('mongoose');
const { Schema } = mongoose;

const DishPriceHistorySchema = new Schema({
  dishId: { type: Schema.Types.ObjectId, ref: 'dishes', required: true },
  oldPrice: { type: Number },
  newPrice: { type: Number },
  changedBy: { type: Schema.Types.ObjectId, ref: 'users' },
  changedAt: { type: Date },
  note: { type: String },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

DishPriceHistorySchema.virtual('dishes', {
  ref: 'dishes',
  localField: 'dishId',
  foreignField: '_id',
  justOne: true
});

DishPriceHistorySchema.virtual('users', {
  ref: 'users',
  localField: 'changedBy',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('dish_price_histories', DishPriceHistorySchema);