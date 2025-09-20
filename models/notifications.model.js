const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'users' },
  orderId: { type: Schema.Types.ObjectId, ref: 'orders' },
  title: { type: String },
  message: { type: String },
  type: { type: String, enum: ['orderStatus', 'newOrder'] }, // orderStatus || newOrder
  status: { type: String, default: 'unread' },
}, {
  timestamps: true
});

NotificationSchema.virtual('users', {
  ref: 'users',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('notifications', NotificationSchema);
