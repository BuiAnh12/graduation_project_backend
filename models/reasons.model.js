const mongoose = require("mongoose");
const { Schema } = mongoose;

const ReasonSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    other: { type: Boolean, required: true, default: false },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("reasons", ReasonSchema);
