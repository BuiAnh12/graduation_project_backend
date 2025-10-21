const mongoose = require("mongoose");
const { Schema } = mongoose;

const ShipperSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "accounts", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "vehicles" },

    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phonenumber: { type: String },
    gender: { type: String, enum: ["male", "female", "other"] },

    // Avatar
    avatarImage: { type: Schema.Types.ObjectId, ref: "images" },

    // Realtime status
    online: { type: Boolean, default: false }, // Shipper đang bật app và sẵn sàng nhận đơn
    busy: { type: Boolean, default: false }, // Đang giao hàng hay không
    firstCheck: { type: Boolean, default: true },
    // Vị trí hiện tại của shipper (được update liên tục từ Android)
    currentLocation: {
      lat: { type: Number },
      lon: { type: Number },
      updatedAt: { type: Date },
    },

    // Đơn hiện tại đang đảm nhận (nếu có)
    currentOrderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      default: null,
    },

    // Danh sách order đã từ chối (để tránh gợi ý lại)
    rejectedOrders: [{ type: Schema.Types.ObjectId, ref: "orders" }],

    // Cài đặt hoạt động
    maxDistanceKm: { type: Number, default: 10 }, // Phạm vi tối đa nhận đơn (tính bằng km)
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ShipperSchema.virtual("accounts", {
  ref: "accounts",
  localField: "accountId",
  foreignField: "_id",
  justOne: true,
});

ShipperSchema.virtual("vehicles", {
  ref: "vehicles",
  localField: "vehicleId",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("shippers", ShipperSchema);
