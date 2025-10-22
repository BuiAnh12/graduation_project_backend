const UserReference = require("../models/user_references.model");
const ErrorCode = require("../constants/errorCodes.enum");

/**
 * Get user reference by userId
 */
const getUserReferenceService = async (userId) => {
  const reference = await UserReference.findById(userId)
    .populate("allergy dislike_taste dislike_food dislike_cooking_method dislike_culture")
    .populate("like_taste like_food like_cooking_method like_culture");

  if (!reference) throw ErrorCode.USER_REFERENCE_NOT_FOUND;
  return reference;
};

/**
 * Create or update user reference
 */
const upsertUserReferenceService = async (userId, data) => {
  try {
    const updated = await UserReference.findByIdAndUpdate(userId, data, {
      new: true,
      upsert: true, // creates if not exist
      runValidators: true,
    })
      .populate("allergy dislike_taste dislike_food dislike_cooking_method dislike_culture")
      .populate("like_taste like_food like_cooking_method like_culture");

    if (!updated) throw ErrorCode.USER_REFERENCE_UPDATE_FAILED;
    return updated;
  } catch (err) {
    console.error("upsertUserReferenceService error:", err.message);
    throw ErrorCode.USER_REFERENCE_UPDATE_FAILED;
  }
};

/**
 * Delete user reference
 */
const deleteUserReferenceService = async (userId) => {
  const deleted = await UserReference.findByIdAndDelete(userId);
  if (!deleted) throw ErrorCode.USER_REFERENCE_NOT_FOUND;
  return { success: true };
};

module.exports = {
  getUserReferenceService,
  upsertUserReferenceService,
  deleteUserReferenceService,
};
