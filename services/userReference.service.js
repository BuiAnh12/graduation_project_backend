const UserReference = require("../models/user_references.model");
const User = require("../models/users.model")
const ErrorCode = require("../constants/errorCodes.enum");

/**
 * Get user reference by userId
 */
const getUserReferenceService = async (userId) => {
  const user = await User.findById(userId).lean();
  const reference = await UserReference.findById(user.user_reference_id)
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
    const { _id, id, ...raw } = data;

    const safeData = {
      allergy: normalizeArray(raw.allergy),
      dislike_taste: normalizeArray(raw.dislike_taste),
      dislike_food: normalizeArray(raw.dislike_food),
      dislike_cooking_method: normalizeArray(raw.dislike_cooking_method),
      dislike_culture: normalizeArray(raw.dislike_culture),
      like_taste: normalizeArray(raw.like_taste),
      like_food: normalizeArray(raw.like_food),
      like_cooking_method: normalizeArray(raw.like_cooking_method),
      like_culture: normalizeArray(raw.like_culture),
    };
    console.log(safeData.dislike_taste)

    const updated = await UserReference.findByIdAndUpdate(_id, safeData, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true, // <-- Important for new docs
    })
      .populate("allergy dislike_taste dislike_food dislike_cooking_method dislike_culture")
      .populate("like_taste like_food like_cooking_method like_culture");

    if (!updated) throw ErrorCode.USER_REFERENCE_UPDATE_FAILED;
    return updated;
  } catch (err) {
    console.error("upsertUserReferenceService error:", err);
    throw ErrorCode.USER_REFERENCE_UPDATE_FAILED;
  }
};

function normalizeArray(arr) {
  return Array.isArray(arr) ? arr.map((t) => (t?._id ? t._id : t)) : [];
}

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
