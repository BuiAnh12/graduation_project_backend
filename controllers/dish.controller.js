const {
    getDishByIdService,
    getDishesByStoreIdService,
    createDishService,
    changeDishStatusService,
    updateDishService,
    deleteDishService,
  } = require("../services/dish.service");
  const ApiResponse = require("../utils/apiResponse");
  
  const getDishById = async (req, res) => {
    try {
      const { dish_id } = req.params;
      const dish = await getDishByIdService(dish_id);
      return ApiResponse.success(res, dish);
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const getDishesByStoreId = async (req, res) => {
    try {
      const { store_id } = req.params;
      const { result, fromCache } = await getDishesByStoreIdService(
        store_id,
        req.query
      );
  
      return ApiResponse.success(
        res,
        result,
        `Dishes retrieved successfully${fromCache ? " (from cache)" : ""}`
      );
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const createDish = async (req, res) => {
    try {
      const { store_id } = req.params;
      const dish = await createDishService(store_id, req.body);
      return ApiResponse.success(res, dish, "Dish created successfully", 201);
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const changeStatus = async (req, res) => {
    try {
      const { dish_id } = req.params;
      await changeDishStatusService(dish_id);
      return ApiResponse.success(
        res,
        null,
        "Dish on/off stock status changed successfully"
      );
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const updateDish = async (req, res) => {
    try {
      const { dish_id } = req.params;
      await updateDishService(dish_id, req.body);
      return ApiResponse.success(res, null, "Dish updated successfully");
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  const deleteDish = async (req, res) => {
    try {
      const { dish_id } = req.params;
      await deleteDishService(dish_id);
      return ApiResponse.success(res, null, "Dish deleted successfully");
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };
  
  module.exports = {
    getDishById,
    getDishesByStoreId,
    createDish,
    changeStatus,
    updateDish,
    deleteDish,
  };
  