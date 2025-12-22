const mongoose = require("mongoose");
const { Schema } = mongoose;

const ReportSchema = new Schema(
  {
    name: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "stores", required: true },
    dishId: { type: Schema.Types.ObjectId, ref: "dishes", required: true },
    reasonId: { type: Schema.Types.ObjectId, ref: "reasons", required: true },
    status: { type: Boolean, required: true, default: false },
    note: { type: String, required: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("reports", ReportSchema);
