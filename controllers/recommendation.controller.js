const asyncHandler = require("express-async-handler");
const createError = require("../utils/createError");
const {
  predictTagService,
  recommendDishService,
  similarDishService,
  behaviorTestService,
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
    const userReference = req.user.user_reference_id || null;
    const result = await recommendDishService(req.body.user_id, req.body.top_k, userReference);
    return ApiResponse.success(res, result, "Recommend dish fetch successfully")
  } catch (error) {
    return ApiResponse.error(res, error)
  }
});

/* -------------------- Similar Dishes -------------------- */
const similarDish = asyncHandler(async (req, res) => {
  try {
    const userReference = req.user.user_reference_id || null;
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

module.exports = {
  predictTag,
  recommendDish,
  similarDish,
  behaviorTest,
};
