const asyncHandler = require("express-async-handler");
const createError = require("../utils/createError");
const {
  predictTagService,
  recommendDishService,
  similarDishService,
  behaviorTestService,
} = require("../services/recommendation.service");

/* -------------------- Predict Tags -------------------- */
const predictTag = asyncHandler(async (req, res, next) => {
  try {
    if (!req.file) return next(createError(400, "Image is required"));
    const result = await predictTagService(req.file.path);
    res.status(200).json(result);
  } catch (error) {
    next(createError(error.statusCode || 500, error));
  }
});

/* -------------------- Recommend Dishes -------------------- */
const recommendDish = asyncHandler(async (req, res, next) => {
  try {
    const result = await recommendDishService(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(createError(error.statusCode || 500, error));
  }
});

/* -------------------- Similar Dishes -------------------- */
const similarDish = asyncHandler(async (req, res, next) => {
  try {
    const result = await similarDishService(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(createError(error.statusCode || 500, error));
  }
});

/* -------------------- Behavior Test -------------------- */
const behaviorTest = asyncHandler(async (req, res, next) => {
  try {
    const result = await behaviorTestService(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(createError(error.statusCode || 500, error));
  }
});

module.exports = {
  predictTag,
  recommendDish,
  similarDish,
  behaviorTest,
};
