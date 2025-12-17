const Rating = require("../models/ratings.model");
const { getPaginatedData } = require("../utils/paging");
const { getStoreIdFromUser } = require("../utils/getStoreIdFromUser");
const ErrorCode = require("../constants/errorCodes.enum");
const { redisCache, CACHE_TTL } = require("../utils/redisCaches");

// Helper to clear all caches related to a store's ratings
const clearRatingCaches = async (storeId) => {
  if (!storeId) return;
  const id = storeId.toString();

  await redisCache.delByPattern(`store:ratings:${id}:*`);

  await redisCache.delByPattern(`store:ratings:owner:${id}:*`);

  await redisCache.del(`store:info:${id}`);

  await redisCache.delByPattern(`stores:list:*`);
};

// ✅ Fetch all ratings for a store (Public View)
const getAllStoreRatingService = async (storeId, query) => {
  const paramString = JSON.stringify(query, Object.keys(query).sort());
  const cacheKey = `store:ratings:${storeId}:${paramString}`;

  const cachedData = await redisCache.get(cacheKey);
  if (cachedData) return cachedData;

  const { limit, page, sort } = query;
  const filterOptions = { storeId };

  const result = await getPaginatedData(
    Rating,
    filterOptions,
    [
      {
        path: "users",
        select: "name avatarImage",
        populate: {
          path: "avatarImage",
          select: "url",
        },
      },
      {
        path: "orderId",
        populate: [
          { path: "stores", select: "name" },
          {
            path: "users",
            select: "name avatarImage",
            populate: { path: "avatarImage", select: "url" },
          },
        ],
      },
      {
        path: "image",
        select: "url",
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

  await redisCache.set(cacheKey, result, CACHE_TTL.SHORT);
  return result;
};

// ✅ Get rating detail
const getDetailRatingService = async (ratingId) => {
  const cacheKey = `rating:detail:${ratingId}`;
  
  const cachedData = await redisCache.get(cacheKey);
  if (cachedData) return cachedData;

  const rating = await Rating.findById(ratingId).populate("store");
  if (!rating) throw ErrorCode.RATING_NOT_FOUND;

  await redisCache.set(cacheKey, rating, CACHE_TTL.LONG);
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

  const newRating = await Rating.create({
    userId,
    storeId,
    orderId,
    ratingValue,
    comment,
    images,
  });

  await clearRatingCaches(storeId);

  return newRating;
};

// ✅ Edit rating
const editStoreRatingService = async (ratingId, body) => {
  const { ratingValue, comment, images } = body;
  const rating = await Rating.findById(ratingId);
  if (!rating) throw ErrorCode.RATING_NOT_FOUND;

  if (ratingValue !== undefined) {
    const value = Number(ratingValue);
    if (isNaN(value) || value < 1 || value > 5)
      throw ErrorCode.INVALID_RATING_VALUE;
    rating.ratingValue = value;
  }

  if (comment !== undefined) rating.comment = comment;
  if (images !== undefined) rating.images = images;

  rating.updatedAt = new Date();
  await rating.save();

  await redisCache.del(`rating:detail:${ratingId}`); // Clear specific detail
  await clearRatingCaches(rating.storeId);

  return rating;
};

// ✅ Delete rating
const deleteStoreRatingService = async (ratingId) => {
  const rating = await Rating.findById(ratingId);
  if (!rating) throw ErrorCode.RATING_NOT_FOUND;

  const storeId = rating.storeId; // Save ID before delete
  await Rating.findByIdAndDelete(ratingId);

  await redisCache.del(`rating:detail:${ratingId}`);
  await clearRatingCaches(storeId);

  return true;
};

// ✅ Get Ratings for Store Owner
const getRatingsByStoreService = async (userId, query) => {
  // 1. Resolve Store ID
  const storeId = await getStoreIdFromUser(userId);
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  // 2. Check Cache
  const paramString = JSON.stringify(query, Object.keys(query).sort());
  const cacheKey = `store:ratings:owner:${storeId}:${paramString}`;

  const cachedData = await redisCache.get(cacheKey);
  if (cachedData) return cachedData;

  const {
    replied, 
    sortBy = "createdAt",
    order = "desc",
    page = 1,
    limit = 10,
  } = query;

  const filter = { storeId };

  if (replied === "true") {
    filter.replied = true;
  } else if (replied === "false") {
    filter.$or = [
      { replied: false },
      { replied: { $exists: false } }, 
    ];
  }

  const sort = {};
  sort[sortBy] = order === "asc" ? 1 : -1;

  const skip = (page - 1) * limit;

  const ratings = await Rating.find(filter)
    .populate({
      path: "users",
      select: "name avatar",
    })
    .populate({
      path: "orders",
      select: "orderNumber totalPrice",
    })
    .populate({
      path: "image",
      select: "url",
    })
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const totalItems = await Rating.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / limit);

  const result = {
    success: true,
    data: ratings,
    meta: {
      totalItems,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit),
    },
  };

  await redisCache.set(cacheKey, result, CACHE_TTL.SHORT);

  return result;
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
  rating.replied = true;
  await rating.save();

  await redisCache.del(`rating:detail:${ratingId}`);
  await clearRatingCaches(storeId);

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