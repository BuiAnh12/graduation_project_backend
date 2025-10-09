const ApiResponse = require("../utils/apiResponse");
const {
  getAllSystemCategoryService,
  createSystemCategoryService,
  getAllSystemCategoriesWithStoreCountService,
  updateSystemCategoryService,
  deleteSystemCategoryService,
  getSystemCategoryByIdService,
} = require("../services/systemCategory.service");

/**
 * @desc    Get all system categories
 * @route   GET /api/v1/system-categories
 * @access  Public
 */
const getAllSystemCategory = async (req, res) => {
  try {
    const categories = await getAllSystemCategoryService();
    return ApiResponse.success(
      res,
      categories,
      "Lấy danh sách loại thức ăn thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const getAllSystemCategoriesWithCount = async (req, res) => {
  try {
    const categories = await getAllSystemCategoriesWithStoreCountService();
    return ApiResponse.success(
      res,
      categories,
      "Lấy danh sách danh mục nhà hàng thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

/**
 * @desc    Get system category by ID
 * @route   GET /api/v1/system-categories/:id
 * @access  Public
 */
const getSystemCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await getSystemCategoryByIdService(id);

    return ApiResponse.success(
      res,
      category,
      "Lấy thông tin loại thức ăn thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

/**
 * @desc    Create a new system category
 * @route   POST /api/v1/system-categories
 * @access  Admin/Manager
 */
const createSystemCategory = async (req, res) => {
  try {
    const category = await createSystemCategoryService(req.body);
    return ApiResponse.success(
      res,
      category,
      "Tạo loại thức ăn thành công",
      201
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

/**
 * @desc    Update an existing system category
 * @route   PUT /api/v1/system-categories/:id
 * @access  Admin/Manager
 */
const updateSystemCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCategory = await updateSystemCategoryService(id, req.body);
    return ApiResponse.success(
      res,
      updatedCategory,
      "Cập nhật loại thức ăn thành công",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

/**
 * @desc    Delete system category
 * @route   DELETE /api/v1/system-categories/:id
 * @access  Admin/Manager
 */
const deleteSystemCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteSystemCategoryService(id);

    return ApiResponse.success(res, deleted, "Xóa loại thức ăn thành công", 200);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

module.exports = {
  getAllSystemCategory,
  getSystemCategory,
  createSystemCategory,
  updateSystemCategory,
  deleteSystemCategory,
  getAllSystemCategoriesWithCount,
};
