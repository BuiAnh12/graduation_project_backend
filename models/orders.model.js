const mongoose = require("mongoose");
const { Schema } = mongoose;

const OrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "stores", required: true },

    orderNumber: { type: Number }, // tracked via counters
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "preparing", "finished", "taken", "delivering", "done"],
    },
    paymentStatus: { type: String },

    subtotalPrice: { type: Number },
    totalDiscount: { type: Number },
    shippingFee: { type: Number },
    finalTotal: { type: Number, required: true },
    currency: { type: String, default: "VND" },

    idempotencyKey: { type: String },

    deleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index suggestion for queries (storeId, status, createdAt)
OrderSchema.index({ storeId: 1, status: 1, createdAt: -1 });

OrderSchema.virtual("users", {
  ref: "users",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

OrderSchema.virtual("stores", {
  ref: "stores",
  localField: "storeId",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("orders", OrderSchema);
