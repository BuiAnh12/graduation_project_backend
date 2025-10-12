const mongoose = require('mongoose');
const { Schema } = mongoose;

const SystemCategorySchema = new Schema({
  name: { type: String, required: true, unique: true },
  image: { type: Schema.Types.ObjectId, ref: 'images' },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

SystemCategorySchema.virtual('images', {
  ref: 'images',
  localField: 'image',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('system_categories', SystemCategorySchema);