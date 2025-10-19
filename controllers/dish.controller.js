const {
  getDishByIdService,
  getDishesByStoreIdService,
  createDishService,
  changeDishStatusService,
  updateDishService,
  deleteDishService,
  getDishDetailByStoreService,
} = require("../services/dish.service");
const ApiResponse = require("../utils/apiResponse");

const getDishById = async (req, res) => {
  try {
    const { dish_id } = req.params;
    const dish = await getDishByIdService(dish_id);
    return ApiResponse.success(res, dish, "Dish fetched successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getDishesByStoreId = async (req, res) => {
  try {
    const { store_id } = req.params;
    const { data, meta } = await getDishesByStoreIdService(store_id, req.query);

    return ApiResponse.success(
      res,
      data,
      "Dishes fetched successfully",
      200,
      meta
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
    const { store_id, dish_id } = req.params;
    const dish = await changeDishStatusService(store_id, dish_id);
    return ApiResponse.success(
      res,
      dish,
      "Dish status updated successfully",
      200
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateDish = async (req, res) => {
  try {
    const { store_id, dish_id } = req.params;
    await updateDishService(store_id, dish_id, req.body);
    return ApiResponse.success(res, null, "Dish updated successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const deleteDish = async (req, res) => {
  try {
    const { store_id, dish_id } = req.params;
    await deleteDishService(store_id, dish_id);
    return ApiResponse.success(res, null, "Dish deleted successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getDetailDishByStore = async (req, res) => {
  try {
    const { store_id, dish_id } = req.params;
    const dish = await getDishDetailByStoreService(store_id, dish_id);
    return ApiResponse.success(res, dish, "Dish fetched successfully", 200);
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
  getDetailDishByStore,
};
