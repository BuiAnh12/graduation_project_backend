const {
    getUserFavoriteService,
    addFavoriteService,
    removeFavoriteService,
    removeAllFavoriteService,
  } = require("../services/favorite.service");
  const ApiResponse = require("../utils/ApiResponse");
  
  const getUserFavorite = async (req, res) => {
    try {
      const favorite = await getUserFavoriteService(req.user._id);
      return ApiResponse.success(res, favorite, "Favorites fetched successfully");
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const addFavorite = async (req, res) => {
    try {
      await addFavoriteService(req.user._id, req.params.storeId);
      return ApiResponse.success(res, null, "Favorite updated successfully", 201);
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const removeFavorite = async (req, res) => {
    try {
      await removeFavoriteService(req.user._id, req.params.storeId);
      return ApiResponse.success(res, null, "Store removed from favorites");
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const removeAllFavorite = async (req, res) => {
    try {
      await removeAllFavoriteService(req.user._id);
      return ApiResponse.success(res, null, "Favorite cleared successfully");
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  module.exports = { getUserFavorite, addFavorite, removeFavorite, removeAllFavorite };
  