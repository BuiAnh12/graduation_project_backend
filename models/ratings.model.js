const mongoose = require("mongoose");
const { Schema } = mongoose;

const RatingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "stores", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "orders", required: true },
    ratingValue: { type: Number },
    comment: { type: String },
    image: { type: Schema.Types.ObjectId, ref: "images" },
    storeReply: { type: String },
    replied: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

RatingSchema.virtual("users", {
  ref: "users",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

RatingSchema.virtual("stores", {
  ref: "stores",
  localField: "storeId",
  foreignField: "_id",
  justOne: true,
});

RatingSchema.virtual("orders", {
  ref: "orders",
  localField: "orderId",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("ratings", RatingSchema);
