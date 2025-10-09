const Favorite = require("../models/favorites.model");
const Store = require("../models/stores.model");
const Rating = require("../models/ratings.model");
const ErrorCode = require("../constants/errorCodes.enum");

const getUserFavoriteService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // find all favorite docs for this user and populate the store
  const favorites = await Favorite.find({ userId })
    .populate({
      path: "storeId",
      select: "name avatarImage status systemCategoryId",
      populate: { path: "systemCategoryId", select: "name" },
      populate: { path: "avatarImage", select: "url"}
    })
    .lean();

  // Return empty list if none found (safer than throwing)
  if (!favorites || favorites.length === 0) {
    return { userId, stores: [] };
  }

  // Extract populated stores and filter out non-existing ones
  let stores = favorites
    .map((f) => f.storeId)
    .filter(Boolean);

  // Keep only approved stores (case-insensitive)
  stores = stores.filter((store) => (store.status || "").toLowerCase() === "approved");

  if (stores.length === 0) {
    return { userId, stores: [] };
  }

  // Aggregate ratings only for the stores in this list
  const storeIds = stores.map((s) => s._id);

  const storeRatings = await Rating.aggregate([
    { $match: { storeId: { $in: storeIds } } },
    {
      $group: {
        _id: "$storeId",
        avgRating: { $avg: "$ratingValue" },
        amountRating: { $sum: 1 },
      },
    },
  ]);

  // Attach rating info to each store
  const enrichedStores = stores.map((store) => {
    const rating = storeRatings.find((r) => r._id.toString() === store._id.toString());
    return {
      ...store,
      avgRating: rating ? rating.avgRating : 0,
      amountRating: rating ? rating.amountRating : 0,
    };
  });

  return { userId, stores: enrichedStores };
};

const addFavoriteService = async (userId, storeId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  if (!storeId) throw ErrorCode.INVALID_REQUEST;

  const store = await Store.findById(storeId);
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  // Check compound uniqueness (userId + storeId)
  const exists = await Favorite.findOne({ userId, storeId });
  if (exists) throw ErrorCode.STORE_ALREADY_IN_FAVORITE;

  const favorite = await Favorite.create({ userId, storeId });
  return favorite;
};

const removeFavoriteService = async (userId, storeId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  if (!storeId) throw ErrorCode.INVALID_REQUEST;

  const deleted = await Favorite.findOneAndDelete({ userId, storeId });
  if (!deleted) throw ErrorCode.FAVORITE_NOT_FOUND;

  return deleted;
};

const removeAllFavoriteService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  const res = await Favorite.deleteMany({ userId });
  return res; // optional: return delete result
};

module.exports = {
  getUserFavoriteService,
  addFavoriteService,
  removeFavoriteService,
  removeAllFavoriteService,
};
