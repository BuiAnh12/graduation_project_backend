const mongoose = require('mongoose');
const { Schema } = mongoose;

const TasteTagSchema = new Schema({
  name: { type: String, required: true },              // ví dụ: "Không cay"
  kind: { type: String, required: true },              // ví dụ: "Cay"
  level: { type: Number, required: true, min: 0 },     // ví dụ: 0, 1, 2, ...
  tag_category_id: { type: Schema.Types.ObjectId, ref: 'tag_categories' },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

TasteTagSchema.virtual('tag_categories', {
  ref: 'tag_categories',
  localField: 'tag_category_id',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('taste_tags', TasteTagSchema);
