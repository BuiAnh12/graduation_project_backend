const ApiResponse = require("../utils/apiResponse");
const {
  getAllToppingsByGroupService,
  getToppingByIdService,
  createToppingService,
  updateToppingService,
  deleteToppingService,
} = require("../services/topping.service");

const getAllToppingsByGroup = async (req, res) => {
  try {
    const { toppingGroupId } = req.params;
    const toppings = await getAllToppingsByGroupService(toppingGroupId);
    return ApiResponse.success(
      res,
      toppings,
      "Lấy danh sách topping thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const getTopping = async (req, res) => {
  try {
    const { id } = req.params;
    const topping = await getToppingByIdService(id);
    return ApiResponse.success(
      res,
      topping,
      "Lấy thông tin topping thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const createTopping = async (req, res) => {
  try {
    const topping = await createToppingService(req.body);
    return ApiResponse.success(res, topping, "Tạo topping thành công", 201);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const updateTopping = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTopping = await updateToppingService(id, req.body);
    return ApiResponse.success(
      res,
      updatedTopping,
      "Cập nhật topping thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const deleteTopping = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteToppingService(id);
    return ApiResponse.success(res, deleted, "Xóa topping thành công", 200);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

module.exports = {
  getAllToppingsByGroup,
  getTopping,
  createTopping,
  updateTopping,
  deleteTopping,
};
