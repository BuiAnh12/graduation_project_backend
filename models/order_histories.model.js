const mongoose = require("mongoose");
const { Schema } = mongoose;

const OrderHistorySchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      required: true,
    },
    shipperId: {
      type: Schema.Types.ObjectId,
      ref: "shippers",
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now, // ghi lại thời điểm hoàn thành
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Cho phép populate thông tin đơn hàng + shipper nếu cần
OrderHistorySchema.virtual("orders", {
  ref: "orders",
  localField: "orderId",
  foreignField: "_id",
  justOne: true,
});

OrderHistorySchema.virtual("shippers", {
  ref: "shippers",
  localField: "shipperId",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("order_histories", OrderHistorySchema);
