const asyncHandler = require("express-async-handler");
const createError = require("../utils/createError");
const { getAllTagsService } = require("../services/userReferenceTag.service");
const ApiResponse = require("../utils/apiResponse");

/**
 * GET /api/v1/user-reference/tags
 * Fetch all available tags grouped by type.
 */
const getAllTags = async (req, res) => {
  try {
    const tags = await getAllTagsService();
    return ApiResponse.success(res, tags, "Tags fetched successfully");  
  } catch (error) {
    return ApiResponse.error(res, error)
  }
};

module.exports = { getAllTags };
