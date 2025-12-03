const asyncHandler = require("express-async-handler");
const createError = require("../utils/createError");
const {
  predictTagService,
  recommendDishService,
  similarDishService,
  behaviorTestService,
  extractTagsService,
  optimizeDescriptionService,
  recommendTagsForOrderService,
  refreshUserEmbeddingService,
  refreshDishEmbeddingService,
} = require("../services/recommendation.service");
const ApiResponse = require("../utils/apiResponse")

/* -------------------- Predict Tags -------------------- */
const predictTag = asyncHandler(async (req, res) => {
  console.log("File received:", req.file);
  if (!req.file) return next(createError(400, "Image is required"));
  try {
    const result = await predictTagService(req.file.path);

    return ApiResponse.success(res, result, "Tag predict fetch successfully")
  } catch (error) {
    console.error("PredictTag Error:", error);
    return ApiResponse.error(res, error)
  }
});

/* -------------------- Recommend Dishes -------------------- */
const recommendDish = asyncHandler(async (req, res) => {
  try {
    const userReference = req.user?.user_reference_id || null;
    const result = await recommendDishService(req.body.user_id, req.body.top_k, userReference, req.body.storeId);
    return ApiResponse.success(res, result, "Recommend dish fetch successfully")
  } catch (error) {
    return ApiResponse.error(res, error)
  }
});

/* -------------------- Similar Dishes -------------------- */
const similarDish = asyncHandler(async (req, res) => {
  try {
    const userReference = req.user?.user_reference_id || null;
    const result = await similarDishService(req.body, userReference);
    return ApiResponse.success(res, result, "Recommend dish fetch successfully")
  } catch (error) {
    return ApiResponse.error(res, error)
  }
});

/* -------------------- Behavior Test -------------------- */
const behaviorTest = asyncHandler(async (req, res) => {
  try {
    const result = await behaviorTestService(req.body);
    return ApiResponse.success(res, result, "Behavior fetch successfully")
  } catch (error) {
    return ApiResponse.error(res, error)
  }
});

const extractTags = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) return next(createError(400, "Dish name is required"));

  try {
    const result = await extractTagsService({ name, description });
    return ApiResponse.success(res, result, "Tags extracted successfully");
  } catch (error) {
    console.error("ExtractTags Error:", error);
    return ApiResponse.error(res, error);
  }
});

/* -------------------- Text: Optimize Description -------------------- */
const optimizeDescription = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) return next(createError(400, "Dish name is required"));

  try {
    const result = await optimizeDescriptionService({ name, description });
    return ApiResponse.success(res, result, "Description optimized successfully");
  } catch (error) {
    console.error("OptimizeDescription Error:", error);
    return ApiResponse.error(res, error);
  }
});

const recommendTagsForOrder = asyncHandler(async (req, res) => {
  const { dish_ids, top_k } = req.body;
  const userReference = req.user?.user_reference_id || null;
  if (!dish_ids || !Array.isArray(dish_ids) || dish_ids.length === 0) {
     // Assuming you have a createError utility or standard response
     return ApiResponse.error(res, { message: "dish_ids array is required" }, 400);
  }

  try {
    const result = await recommendTagsForOrderService(dish_ids, top_k, userReference);
    return ApiResponse.success(res, result, "Order-based tags fetched successfully");
  } catch (error) {
    console.error("RecommendTagsOrder Error:", error);
    return ApiResponse.error(res, error);
  }
});

const refreshUserEmbedding = asyncHandler(async (req, res) => {
  const { user_id, user_data } = req.body;

  // Basic validation
  if (!user_id || !user_data) {
    return next(createError(400, "user_id and user_data are required"));
  }

  try {
    const result = await refreshUserEmbeddingService(user_id, user_data);
    return ApiResponse.success(res, result, "User embedding refreshed successfully");
  } catch (error) {
    console.error("Refresh User Error:", error);
    return ApiResponse.error(res, error);
  }
});

const refreshDishEmbedding = asyncHandler(async (req, res) => {
  const { dish_id, dish_data } = req.body;

  if (!dish_id || !dish_data) {
    return next(createError(400, "dish_id and dish_data are required"));
  }

  try {
    const result = await refreshDishEmbeddingService(dish_id, dish_data);
    return ApiResponse.success(res, result, "Dish embedding refreshed successfully");
  } catch (error) {
    console.error("Refresh Dish Error:", error);
    return ApiResponse.error(res, error);
  }
});

module.exports = {
  predictTag,
  recommendDish,
  similarDish,
  behaviorTest,
  extractTags,   
  optimizeDescription,
  recommendTagsForOrder,
  refreshUserEmbedding,
  refreshDishEmbedding,
};
