const ApiResponse = require("../utils/apiResponse");
const {
  getAllToppingGroupByStoreService,
  getToppingGroupDetailService,
  createToppingGroupService,
  updateToppingGroupService,
  deleteToppingGroupService,
} = require("../services/toppingGroup.service");

const getAllToppingGroupByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const groups = await getAllToppingGroupByStoreService(storeId);
    return ApiResponse.success(
      res,
      groups,
      "Lấy danh sách nhóm topping thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const getToppingGroupDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const groupDetail = await getToppingGroupDetailService(id);
    return ApiResponse.success(
      res,
      groupDetail,
      "Lấy chi tiết nhóm topping thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const createToppingGroup = async (req, res) => {
  try {
    const group = await createToppingGroupService(req.body);
    return ApiResponse.success(res, group, "Tạo nhóm topping thành công", 201);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const updateToppingGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedGroup = await updateToppingGroupService(id, req.body);
    return ApiResponse.success(
      res,
      updatedGroup,
      "Cập nhật nhóm topping thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const deleteToppingGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteToppingGroupService(id);
    return ApiResponse.success(
      res,
      deleted,
      "Xóa nhóm topping thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

module.exports = {
  getAllToppingGroupByStore,
  getToppingGroupDetail,
  createToppingGroup,
  updateToppingGroup,
  deleteToppingGroup,
};
