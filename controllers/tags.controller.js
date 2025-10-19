const ErrorCode = require("../constants/errorCodes.enum");
const {
  getAllTasteTagsService,
  getAllCookingMethodTagsService,
  getAllFoodTagsService,
  getAllCultureTagsService,
  getAllTagsService,
} = require("../services/tags.service");
const ApiResponse = require("../utils/apiResponse");

const getAllCookingMethodTags = async (req, res) => {
  try {
    const tags = await getAllCookingMethodTagsService();
    return ApiResponse.success(res, tags, "Get tags successfully");
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const getAllCultureTags = async (req, res) => {
  try {
    const tags = await getAllCultureTagsService();
    return ApiResponse.success(res, tags, "Get tags successfully");
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};
const getAllFoodTags = async (req, res) => {
  try {
    const tags = await getAllFoodTagsService();
    return ApiResponse.success(res, tags, "Get tags successfully");
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};
const getAllTasteTags = async (req, res) => {
  try {
    const tags = await getAllTasteTagsService();
    return ApiResponse.success(res, tags, "Get tags successfully");
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};
const getAllTags = async (req, res) => {
  try {
    const tags = await getAllTagsService();
    return ApiResponse.success(res, tags, "Get tags successfully");
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};
module.exports = {
  getAllCookingMethodTags,
  getAllCultureTags,
  getAllFoodTags,
  getAllTasteTags,
  getAllTags,
};
