const mongoose = require('mongoose');
const { Schema } = mongoose;

const StaffSchema = new Schema({
  acountId: { type: Schema.Types.ObjectId, ref: 'accounts' },

  role: { type: String },

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

StaffSchema.virtual('accounts', {
  ref: 'accounts',
  localField: 'acountId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('staffs', StaffSchema);
