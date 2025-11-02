const mongoose = require("mongoose");
const { Schema } = mongoose;

const OrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "stores", required: true },
    isGroupOrder: { type: Boolean, default: false },
    orderNumber: { type: Number }, // tracked via counters\
    paymentMethod: { type: String },
    status: {
      type: String,
      default: "pending",
      enum: [
        "pending",
        "preparing",
        "finished",
        "taken",
        "delivering",
        "delivered",
        "done",
      ],
    },
    paymentStatus: { type: String },
    participants: [{ type: Schema.Types.ObjectId, ref: "cart_participants" }],
    subtotalPrice: { type: Number },
    totalDiscount: { type: Number },
    shippingFee: { type: Number },
    finalTotal: { type: Number, required: true },
    currency: { type: String, default: "VND" },

    idempotencyKey: { type: String },
    shipperId: { type: Schema.Types.ObjectId, ref: "shippers", default: null },
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

OrderSchema.virtual("shipInfo", {
  ref: "order_ship_infos",
  localField: "_id",
  foreignField: "orderId",
  justOne: true, // Mỗi đơn hàng chỉ có 1 ship info
});
module.exports = mongoose.model("orders", OrderSchema);
