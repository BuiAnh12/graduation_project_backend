const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserReferenceSchema = new Schema({
  allergy: [{ type: Schema.Types.ObjectId, ref: 'food_tags' }],
  
  dislike_taste: [{ type: Schema.Types.ObjectId, ref: 'taste_tags' }],
  dislike_food: [{ type: Schema.Types.ObjectId, ref: 'food_tags' }],
  dislike_cooking_method: [{ type: Schema.Types.ObjectId, ref: 'cooking_method_tags' }],
  dislike_culture: [{ type: Schema.Types.ObjectId, ref: 'culture_tags' }],

  like_taste: [{ type: Schema.Types.ObjectId, ref: 'taste_tags' }],
  like_food: [{ type: Schema.Types.ObjectId, ref: 'food_tags' }],
  like_cooking_method: [{ type: Schema.Types.ObjectId, ref: 'cooking_method_tags' }],
  like_culture: [{ type: Schema.Types.ObjectId, ref: 'culture_tags' }],
}, {
  timestamps: false, // No timestamps for this model
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('user_references', UserReferenceSchema);
