const mongoose = require('mongoose');
const { Schema } = mongoose;

const FavoriteSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'stores', required: true },
}, {
  timestamps: { createdAt: true, updatedAt: false } // original had only createdAt
});

// Unique compound index (userId, storeId)
FavoriteSchema.index({ userId: 1, storeId: 1 }, { unique: true });

FavoriteSchema.virtual('users', {
  ref: 'users',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

FavoriteSchema.virtual('stores', {
  ref: 'stores',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('favorites', FavoriteSchema);
