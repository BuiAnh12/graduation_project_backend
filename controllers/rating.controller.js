const {
  getAllStoreRatingService,
  getDetailRatingService,
  addStoreRatingService,
  editStoreRatingService,
  deleteStoreRatingService,
  getRatingsByStoreService,
  replyToRatingService,
} = require("../services/rating.service");
const ApiResponse = require("../utils/apiResponse");

const getAllStoreRating = async (req, res) => {
  try {
    const data = await getAllStoreRatingService(req.params.storeId, req.query);
    return ApiResponse.success(res, data, "Ratings fetched successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getDetailRating = async (req, res) => {
  try {
    const data = await getDetailRatingService(req.params.ratingId);
    return ApiResponse.success(res, data, "Rating detail fetched successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const addStoreRating = async (req, res) => {
  try {
    const data = await addStoreRatingService(req.user?._id, req.body);
    return ApiResponse.success(res, data, "Rating added successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const editStoreRating = async (req, res) => {
  try {
    const data = await editStoreRatingService(req.params.ratingId, req.body);
    return ApiResponse.success(res, data, "Rating updated successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const deleteStoreRating = async (req, res) => {
  try {
    const data = await deleteStoreRatingService(req.params.ratingId);
    return ApiResponse.success(res, data, "Rating deleted successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getRatingsByStore = async (req, res) => {
  try {
    // gọi service, destructure ra data + meta
    const { data, meta } = await getRatingsByStoreService(
      req.user?._id,
      req.query
    );

    // trả về cùng format với getAllStaffByStore
    return ApiResponse.success(
      res,
      data,
      "Store ratings fetched successfully",
      200,
      meta
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const replyToRating = async (req, res) => {
  try {
    const data = await replyToRatingService(
      req.user?._id,
      req.params.id,
      req.body
    );
    return ApiResponse.success(res, data, "Reply saved successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

module.exports = {
  getAllStoreRating,
  getDetailRating,
  addStoreRating,
  editStoreRating,
  deleteStoreRating,
  getRatingsByStore,
  replyToRating,
};
