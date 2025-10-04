const Favorite = require("../models/favorites.model");
const Store = require("../models/stores.model");
const Rating = require("../models/ratings.model");
const ErrorCode = require("../constants/errorCodes.enum");

const getUserFavoriteService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  let favorite = await Favorite.findOne({ userId })
    .populate({
      path: "stores",
      select: "name avatar status storeCategory",
      populate: { path: "storeCategory" },
    })
    .lean();

  if (!favorite) throw ErrorCode.FAVORITE_NOT_FOUND;

  // filter out only approved stores
  favorite.store = favorite.store.filter((store) => store.status === "APPROVED");

  // get ratings
  const storeRatings = await Rating.aggregate([
    {
      $group: {
        _id: "$storeId",
        avgRating: { $avg: "$ratingValue" },
        amountRating: { $sum: 1 },
      },
    },
  ]);

  favorite.store = favorite.store.map((store) => {
    const rating = storeRatings.find((r) => r._id.toString() === store._id.toString());
    return {
      ...store,
      avgRating: rating ? rating.avgRating : 0,
      amountRating: rating ? rating.amountRating : 0,
    };
  });

  return favorite;
};

const addFavoriteService = async (userId, storeId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  if (!storeId) throw ErrorCode.INVALID_REQUEST;

  const store = await Store.findById(storeId);
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  let favoriteRecord = await Favorite.findOne({ userId });

  if (!favoriteRecord) {
    favoriteRecord = new Favorite({ userId, store: [storeId] });
  } else {
    if (favoriteRecord.store.includes(storeId)) throw ErrorCode.STORE_ALREADY_IN_FAVORITE;
    favoriteRecord.store.push(storeId);
  }

  await favoriteRecord.save();
};

const removeFavoriteService = async (userId, storeId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  if (!storeId) throw ErrorCode.INVALID_REQUEST;

  const store = await Store.findById(storeId);
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const favoriteRecord = await Favorite.findOne({ userId });
  if (!favoriteRecord) throw ErrorCode.FAVORITE_NOT_FOUND;

  favoriteRecord.store = favoriteRecord.store.filter((id) => id.toString() !== storeId.toString());

  if (favoriteRecord.store.length === 0) {
    await Favorite.deleteOne({ _id: favoriteRecord._id });
  } else {
    await favoriteRecord.save();
  }
};

const removeAllFavoriteService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  await Favorite.deleteMany({ userId });
};

module.exports = {
  getUserFavoriteService,
  addFavoriteService,
  removeFavoriteService,
  removeAllFavoriteService,
};
