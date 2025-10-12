const mongoose = require('mongoose');
const { Schema } = mongoose;

const FoodTagSchema = new Schema({
  name: { type: String, required: true },
  tag_category_id: { type: Schema.Types.ObjectId, ref: 'tag_categories' },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

FoodTagSchema.virtual('tag_categories', {
  ref: 'tag_categories',
  localField: 'tag_category_id',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('food_tags', FoodTagSchema);
