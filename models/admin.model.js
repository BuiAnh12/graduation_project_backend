const mongoose = require("mongoose");
const { AdminRoles } = require("../constants/roles.enum");
const { Schema } = mongoose;

const AdminSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts" },

    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phonenumber: { type: String },
    gender: { type: String },
    role: [
      {
        type: String,
        enum: Object.values(AdminRoles),
        require: true,
      },
    ],
    avatarImage: { type: Schema.Types.ObjectId, ref: "images" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AdminSchema.virtual("accounts", {
  ref: "accounts",
  localField: "accountId",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("admin", AdminSchema);
