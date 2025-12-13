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
    // 1. Chuẩn bị dữ liệu sạch
    const { _id, id, ...raw } = data; // Loại bỏ ID từ input để tránh conflict
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

    // 2. Tìm User để lấy user_reference_id hiện tại (Source of Truth)
    const user = await User.findById(userId);
    if (!user) throw ErrorCode.USER_NOT_FOUND;

    let resultRef;

    if (user.user_reference_id) {
      // --- TRƯỜNG HỢP 1: ĐÃ CÓ REFERENCE -> UPDATE ---
      resultRef = await UserReference.findByIdAndUpdate(
        user.user_reference_id,
        safeData,
        { new: true, runValidators: true }
      );
    } else {
      // --- TRƯỜNG HỢP 2: CHƯA CÓ -> TẠO MỚI & LIÊN KẾT ---
      
      // A. Tạo UserReference mới
      const newRef = await UserReference.create(safeData);
      
      // B. Cập nhật User để trỏ vào Reference mới tạo (QUAN TRỌNG)
      user.user_reference_id = newRef._id;
      await user.save();

      resultRef = newRef;
    }

    if (!resultRef) throw ErrorCode.USER_REFERENCE_UPDATE_FAILED;

    // 3. Populate dữ liệu trước khi trả về
    // Mongoose 6+ hỗ trợ populate trực tiếp trên doc instance
    await resultRef.populate([
      "allergy",
      "dislike_taste",
      "dislike_food",
      "dislike_cooking_method",
      "dislike_culture",
      "like_taste",
      "like_food",
      "like_cooking_method",
      "like_culture"
    ]);

    return resultRef;

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

const addTagsService = async (userId, tags) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return null; // Nothing to update
  }

  // 1. Get the UserReference ID from the User model
  const user = await User.findById(userId);
  if (!user) throw ErrorCode.USER_NOT_FOUND;

  let userRefId = user.user_reference_id;

  // Create UserReference if it doesn't exist (Safety check)
  if (!userRefId) {
    const newRef = await UserReference.create({ user_id: userId });
    user.user_reference_id = newRef._id;
    await user.save();
    userRefId = newRef._id;
  }

  // 2. Prepare the Update Operation
  // We map the 'type' from frontend/AI to the UserReference schema field names
  const updateOps = {};

  // Map frontend 'type' -> UserReference schema field
  const typeToFieldMap = {
    food: "like_food",
    taste: "like_taste",
    culture: "like_culture",
    cooking_method: "like_food", // Usually cooking method maps to food or has no specific like field? 
    // NOTE: Check your UserReference Schema. If 'like_cooking_method' doesn't exist, 
    // you might map it to 'like_food' or ignore it. 
    // Assuming 'like_food' is a catch-all or you add 'like_cooking_method' to schema.
  };

  tags.forEach((tag) => {
    const fieldName = typeToFieldMap[tag.type];
    
    if (fieldName) {
      if (!updateOps[fieldName]) {
        updateOps[fieldName] = { $each: [] };
      }
      updateOps[fieldName].$each.push(tag._id);
    }
  });

  // 3. Execute Update using $addToSet (avoids duplicates automatically)
  if (Object.keys(updateOps).length > 0) {
    await UserReference.findByIdAndUpdate(
      userRefId,
      { $addToSet: updateOps },
      { new: true }
    );
  }

  // Return the updated (and populated) reference
  return await getUserReferenceService(userId);
};

module.exports = {
  getUserReferenceService,
  upsertUserReferenceService,
  deleteUserReferenceService,
  addTagsService
};
