const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserReferenceSchema = new Schema({
  allergy: [{ type: String }],
  
  dislike_taste: [{ type: String }],
  dislike_food: [{ type: String }],
  dislike_cooking_method: [{ type: String }],
  dislike_culture: [{ type: String }],

  like_taste: [{ type: String }],
  like_food: [{ type: String }],
  like_cooking_method: [{ type: String }],
  like_culture: [{ type: String }],
}, {
  timestamps: false, // No timestamps for this model
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('user_references', UserReferenceSchema);
