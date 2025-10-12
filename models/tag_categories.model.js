const mongoose = require('mongoose');
const { Schema } = mongoose;

const TagCategorySchema = new Schema({
  name: { type: String, required: true },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('tag_categories', TagCategorySchema);
