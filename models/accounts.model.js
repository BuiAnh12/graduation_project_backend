const mongoose = require('mongoose');
const { Schema } = mongoose;

const AccountSchema = new Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },

  refreshToken: { type: String },
  isGoogleLogin: { type: Boolean, default: false },

  otp: { type: String },
  otpExpires: { type: Date },

  blocked: { type: Boolean, default: false },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals could be added by related models (users, shippers, staffs...)
// but reverse virtuals can be added if you want (not required here).

module.exports = mongoose.model('accounts', AccountSchema);
