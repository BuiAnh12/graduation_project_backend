const ApiResponse = require("../utils/apiResponse");
const {
  getAllCategoryByStoreService,
  getCategoryByIdService,
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
} = require("../services/category.service");

const getAllCategoryByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const categories = await getAllCategoryByStoreService(storeId);
    return ApiResponse.success(
      res,
      categories,
      "Lấy danh sách loại món thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await getCategoryByIdService(id);
    return ApiResponse.success(
      res,
      category,
      "Lấy thông tin loại món thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const createCategory = async (req, res) => {
  try {
    const category = await createCategoryService(req.body);
    return ApiResponse.success(res, category, "Tạo loại món thành công", 201);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

/**
 * @desc    Update an existing category
 * @route   PUT /api/v1/categories/:id
 * @access  Admin/Manager
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCategory = await updateCategoryService(id, req.body);
    return ApiResponse.success(
      res,
      updatedCategory,
      "Cập nhật loại món thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteCategoryService(id);
    return ApiResponse.success(res, deleted, "Xóa loại món thành công", 200);
  } catch (error) {
    return ApiResponse.error(res, (message = error.message), error);
  }
};

module.exports = {
  getAllCategoryByStore,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
