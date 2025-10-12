const mongoose = require('mongoose');
const { Schema } = mongoose;

const ActivityLogSchema = new Schema({
  entity: { type: String },
  entityId: { type: Schema.Types.ObjectId },
  action: { type: String, enum: ['update', 'create', 'delete'] },
  actorId: { type: Schema.Types.ObjectId, ref: 'users' },
  payload: { type: Schema.Types.Mixed }, // JSON
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

ActivityLogSchema.virtual('users', {
  ref: 'users',
  localField: 'actorId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('activity_logs', ActivityLogSchema);