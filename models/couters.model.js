const mongoose = require("mongoose");
const { Schema } = mongoose;

const CounterSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g., 'invoice', 'order'
    type: { type: String, enum: ["order", "invoice"], required: true },
    date: { type: Date, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "stores", required: true },
    seq: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("counters", CounterSchema);