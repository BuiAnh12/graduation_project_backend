const mongoose = require('mongoose');
const { Schema } = mongoose;

const CategorySchema = new Schema({
  name: { type: String, required: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'stores', required: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

CategorySchema.virtual('stores', {
  ref: 'stores',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('categories', CategorySchema);
