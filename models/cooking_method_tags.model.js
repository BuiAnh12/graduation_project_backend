const mongoose = require('mongoose');
const { Schema } = mongoose;

const CookingMethodTagSchema = new Schema({
  name: { type: String, required: true },
  tag_category_id: { type: Schema.Types.ObjectId, ref: 'tag_categories' },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

CookingMethodTagSchema.virtual('tag_categories', {
  ref: 'tag_categories',
  localField: 'tag_category_id',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('cooking_method_tags', CookingMethodTagSchema);
