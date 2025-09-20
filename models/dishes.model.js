const mongoose = require('mongoose');
const { Schema } = mongoose;

const DishSchema = new Schema({
  name: { type: String, required: true },
  sku: { type: String },
  price: { type: Number, required: true },
  category: { type: Schema.Types.ObjectId, ref: 'categories' },
  storeId: { type: Schema.Types.ObjectId, ref: 'stores', required: true },
  image: { type: Schema.Types.ObjectId, ref: 'images' },
  description: { type: String },

  stockStatus: { type: String, required: true, default: 'available', enum:['available', 'out_of_stock']  },
  stockCount: { type: Number }, // optional inventory count, -1 means disabled
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

DishSchema.virtual('stores', {
  ref: 'stores',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true
});

DishSchema.virtual('categories', {
  ref: 'categories',
  localField: 'category',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('dishes', DishSchema);
