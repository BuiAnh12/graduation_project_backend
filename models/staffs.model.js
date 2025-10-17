const mongoose = require("mongoose");
const { StoreRoles } = require("../constants/roles.enum");
const { Schema } = mongoose;
const crypto = require("crypto");
const StaffSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts" },

    role: [
      {
        type: String,
        enum: Object.values(StoreRoles),
        require: true,
      },
    ],

    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phonenumber: { type: String },
    gender: { type: String },

    avatarImage: { type: Schema.Types.ObjectId, ref: "images" },
    otp: String,
    otpExpires: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

StaffSchema.virtual("accounts", {
  ref: "accounts",
  localField: "accountId",
  foreignField: "_id",
  justOne: true,
});
StaffSchema.methods.createOtp = async function () {
  // Tạo OTP gồm 6 số
  const newOTP = Math.floor(100000 + Math.random() * 900000).toString();

  // Mã hóa OTP trước khi lưu vào database
  this.otp = crypto.createHash("sha256").update(newOTP).digest("hex");

  // Thời gian hết hạn trong 2 phút
  this.otpExpires = Date.now() + 2 * 60 * 1000;

  // Trả về OTP (chưa mã hóa) để gửi cho người dùng
  return newOTP;
};

module.exports = mongoose.model("staffs", StaffSchema);
