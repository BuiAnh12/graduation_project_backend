const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  accountId: { type: Schema.Types.ObjectId, ref: 'accounts' },

  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phonenumber: { type: String },
  gender: { type: String },

  avatarImage: { type: Schema.Types.ObjectId, ref: 'images' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual named after the referenced table
UserSchema.virtual('accounts', {
  ref: 'accounts',
  localField: 'accountId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('users', UserSchema);
