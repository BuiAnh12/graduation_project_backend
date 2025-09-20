const mongoose = require('mongoose');
const { Schema } = mongoose;

const AdminSchema = new Schema({
  acountId: { type: Schema.Types.ObjectId, ref: 'accounts' },

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

AdminSchema.virtual('accounts', {
  ref: 'accounts',
  localField: 'acountId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('admin', AdminSchema);
