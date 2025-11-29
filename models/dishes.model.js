const mongoose = require("mongoose");
const { Schema } = mongoose;

const DishSchema = new Schema(
  {
    name: { type: String, required: true },
    dishTags: [{ type: Schema.Types.ObjectId, ref: "food_tags" }],
    tasteTags: [{ type: Schema.Types.ObjectId, ref: "taste_tags" }],
    cookingMethodtags: [
      { type: Schema.Types.ObjectId, ref: "cooking_method_tags" },
    ],
    cultureTags: [{ type: Schema.Types.ObjectId, ref: "culture_tags" }],
    price: { type: Number, required: true },
    category: { type: Schema.Types.ObjectId, ref: "categories" },
    storeId: { type: Schema.Types.ObjectId, ref: "stores", required: true },
    image: { type: Schema.Types.ObjectId, ref: "images" },
    description: { type: String },

    deleted: { type: Boolean, default: false },

    stockStatus: {
      type: String,
      required: true,
      default: "out_of_stock",
      enum: ["available", "out_of_stock"],
    },
    stockCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

DishSchema.virtual("stores", {
  ref: "stores",
  localField: "storeId",
  foreignField: "_id",
  justOne: true,
});

DishSchema.virtual("categories", {
  ref: "categories",
  localField: "category",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("dishes", DishSchema);
