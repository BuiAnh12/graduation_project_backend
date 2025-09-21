const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { Schema } = mongoose;

const AccountSchema = new Schema(
  {
    password: { type: String, required: true },

    refreshToken: { type: String },
    isGoogleLogin: { type: Boolean, default: false },

    otp: { type: String },
    otpExpires: { type: Date },

    blocked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AccountSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

AccountSchema.methods.isPasswordMatched = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtuals could be added by related models (users, shippers, staffs...)
// but reverse virtuals can be added if you want (not required here).

module.exports = mongoose.model("accounts", AccountSchema);
