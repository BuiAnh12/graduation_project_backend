const {
    getAllStoreService,
    getStoreInformationService,
    getAllDishInStoreService,
    getDetailDishService,
  } = require("../services/store.service");
  const ApiResponse = require("../utils/ApiResponse");
  
  const getAllStore = async (req, res) => {
    try {
      const stores = await getAllStoreService(req.query);
      return ApiResponse.success(res, stores, "Stores fetched successfully");
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const getStoreInformation = async (req, res) => {
    try {
      const store = await getStoreInformationService(req.params.storeId);
      return ApiResponse.success(res, store, "Store information fetched successfully");
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const getAllDishInStore = async (req, res) => {
    try {
      const dishes = await getAllDishInStoreService(req.params.storeId);
      return ApiResponse.success(res, dishes, "Dishes fetched successfully");
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const getDetailDish = async (req, res) => {
    try {
      const dish = await getDetailDishService(req.params.dishId);
      return ApiResponse.success(res, dish, "Dish details fetched successfully");
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  module.exports = { getAllStore, getStoreInformation, getAllDishInStore, getDetailDish };
  