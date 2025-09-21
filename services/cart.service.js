const Cart = require("../models/carts.model");
const Rating = require("../models/ratings.model");

const getUserCartService = async (userId) => {
  if (!userId) {
    throw new Error("User not found");
  }

  const carts = await Cart.find({ userId })
    .populate({
      path: "storeId",
      populate: { path: "systemCategoryId" },
    })
    .populate({
      path: "items", // assuming a virtual populate for cart_items
      populate: [
        {
          path: "dishId",
          select: "name price image description",
        },
        {
          path: "toppings", // assuming a virtual populate for cart_item_toppings
          populate: {
            path: "toppingId",
            select: "name price",
          },
        },
      ],
    })
    .lean();

  if (!carts || carts.length === 0) {
    return [];
  }

  // Lọc carts của store đã được duyệt
  const approvedCarts = carts.filter(
    (cart) => cart.storeId?.status === "APPROVED"
  );

  // Lấy rating trung bình + số lượng rating theo store
  const storeRatings = await Rating.aggregate([
    {
      $group: {
        _id: "$storeId",
        avgRating: { $avg: "$ratingValue" },
        amountRating: { $sum: 1 },
      },
    },
  ]);

  // Gắn rating vào store
  const updatedCarts = approvedCarts.map((cart) => {
    const rating = storeRatings.find(
      (r) => r._id.toString() === cart.storeId._id.toString()
    );

    return {
      ...cart,
      storeId: {
        ...cart.storeId,
        avgRating: rating?.avgRating || 0,
        amountRating: rating?.amountRating || 0,
      },
    };
  });

  return updatedCarts;
};

module.exports = {
  getUserCartService,
};
