const Rating = require("../models/ratings.model");
const { getPaginatedData } = require("../utils/paging");
const { getStoreIdFromUser } = require("../utils/getStoreIdFromUser");
const ErrorCode = require("../constants/errorCodes.enum");

// ✅ Fetch all ratings for a store
const getAllStoreRatingService = async (storeId, query) => {
  const { limit, page, sort } = query;
  const filterOptions = { storeId };

  const result = await getPaginatedData(
    Rating,
    filterOptions,
    [
      { path: "user", select: "name avatar" },
      {
        path: "order",
        populate: [
          { path: "store", select: "name" },
          { path: "user", select: "name avatar" },
          { path: "items", populate: { path: "toppings" } },
        ],
      },
    ],
    parseInt(limit),
    parseInt(page)
  );

  if (sort === "desc") {
    result.data.sort((a, b) => b.ratingValue - a.ratingValue);
  } else if (sort === "asc") {
    result.data.sort((a, b) => a.ratingValue - b.ratingValue);
  }

  return result;
};

// ✅ Get rating detail
const getDetailRatingService = async (ratingId) => {
  const rating = await Rating.findById(ratingId).populate("store");
  if (!rating) throw ErrorCode.RATING_NOT_FOUND;
  return rating;
};

// ✅ Add new rating
const addStoreRatingService = async (userId, body) => {
  const { storeId, orderId, ratingValue, comment, images } = body;

  if (!userId) throw ErrorCode.UNAUTHORIZED;
  if (!storeId || !orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (typeof ratingValue !== "number" || ratingValue < 1 || ratingValue > 5) {
    throw ErrorCode.INVALID_RATING_VALUE;
  }
  if (!comment?.trim() && (!images || images.length === 0)) {
    throw ErrorCode.RATING_CONTENT_REQUIRED;
  }

  const existing = await Rating.findOne({ userId, orderId });
  if (existing) throw ErrorCode.ALREADY_RATED;

  return await Rating.create({ userId, storeId, orderId, ratingValue, comment, images });
};

// ✅ Edit rating
const editStoreRatingService = async (ratingId, body) => {
  const { ratingValue, comment, images } = body;
  const rating = await Rating.findById(ratingId);
  if (!rating) throw ErrorCode.RATING_NOT_FOUND;

  if (ratingValue !== undefined) {
    const value = Number(ratingValue);
    if (isNaN(value) || value < 1 || value > 5) throw ErrorCode.INVALID_RATING_VALUE;
    rating.ratingValue = value;
  }

  if (comment !== undefined) rating.comment = comment;
  if (images !== undefined) rating.images = images;

  rating.updatedAt = new Date();
  await rating.save();
  return rating;
};

// ✅ Delete rating
const deleteStoreRatingService = async (ratingId) => {
  const rating = await Rating.findById(ratingId);
  if (!rating) throw ErrorCode.RATING_NOT_FOUND;

  await Rating.findByIdAndDelete(ratingId);
  return true;
};

// ✅ Get ratings by store (owner view)
const getRatingsByStoreService = async (userId, query) => {
  const storeId = await getStoreIdFromUser(userId);
  const { page, limit, replied, sort = "-createdAt" } = query;

  const filterOptions = { storeId };
  if (replied === "true") filterOptions.storeReply = { $ne: "" };
  else if (replied === "false") filterOptions.storeReply = "";

  return await getPaginatedData(Rating, filterOptions, "user order", limit, page, sort);
};

// ✅ Reply to a rating
const replyToRatingService = async (userId, ratingId, body) => {
  const storeId = await getStoreIdFromUser(userId);
  const { storeReply } = body;

  if (typeof storeReply !== "string") throw ErrorCode.INVALID_REPLY;

  const rating = await Rating.findById(ratingId);
  if (!rating) throw ErrorCode.RATING_NOT_FOUND;

  if (rating.storeId.toString() !== storeId.toString()) {
    throw ErrorCode.FORBIDDEN;
  }

  rating.storeReply = storeReply;
  await rating.save();
  return rating;
};

module.exports = {
  getAllStoreRatingService,
  getDetailRatingService,
  addStoreRatingService,
  editStoreRatingService,
  deleteStoreRatingService,
  getRatingsByStoreService,
  replyToRatingService,
};
