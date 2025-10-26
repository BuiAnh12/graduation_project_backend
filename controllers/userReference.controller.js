const asyncHandler = require("express-async-handler");
const createError = require("../utils/createError");
const {
  getUserReferenceService,
  upsertUserReferenceService,
  deleteUserReferenceService,
} = require("../services/userReference.service");
const ApiResponse = require("../utils/apiResponse");

/**
 * GET /api/v1/user-reference
 * Retrieve current user's reference profile
 */
const getUserReference = async (req, res, next) => {
  try {
    const userId = req?.user?._id;
    console.log(userId)
    const result = await getUserReferenceService(userId);
    return ApiResponse.success(res, result, "User reference fetched successfully");
  } catch (error) {
    return ApiResponse.error(res, error)
  }
};

/**
 * PUT /api/v1/user-reference
 * Update or create user reference preferences
 */
const updateUserReference = async (req, res, next) => {
  try {
    const userId = req?.user?._id;
    const result = await upsertUserReferenceService(userId, req.body);
    return ApiResponse.success(res, result, "User reference update successfully")
  } catch (error) {
    return ApiResponse.error(res, error)
  }
};

/**
 * DELETE /api/v1/user-reference
 * Delete user reference (optional)
 */
const deleteUserReference = async (req, res, next) => {
  try {
    const userId = req?.user?._id;
    await deleteUserReferenceService(userId);
    res.status(200).json({ success: true, message: "User reference deleted" });
    return ApiResponse.success(res, null, "User reference delete successfully")
  } catch (error) {
    return ApiResponse.error(res, error)
  }
};

module.exports = {
  getUserReference,
  updateUserReference,
  deleteUserReference,
};
