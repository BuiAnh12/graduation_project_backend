const asyncHandler = require("express-async-handler");
const ApiResponse = require("../utils/ApiResponse");
const systemCategoryService = require("../services/systemCategory.service");
const ErrorCode = require("../constants/errorCodes.enum");

/**
 * @desc    Get all system categories
 * @route   GET /api/v1/system-categories
 * @access  Public
 */
const getAllSystemCategory = asyncHandler(async (req, res) => {
  const categories = await systemCategoryService.getAllSystemCategory();
  return ApiResponse.success(res, categories, "Lấy danh sách loại thức ăn thành công", 200)
});

/**
 * @desc    Get system category by ID
 * @route   GET /api/v1/system-categories/:id
 * @access  Public
 */
const getSystemCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await systemCategoryService.getSystemCategoryById(id);

  if (!category) {
    return ApiResponse.error(res, ErrorCode.SYSTEM_CATEGORY_NOT_FOUND);
  }

  return ApiResponse.success(res, category, "Lấy thông tin loại thức ăn thành công", 200)
});

/**
 * @desc    Create a new system category
 * @route   POST /api/v1/system-categories
 * @access  Admin/Manager
 */
const createSystemCategory = asyncHandler(async (req, res) => {
  const { name, image } = req.body;

  if (!name || typeof name !== "string") {
    return ApiResponse.error(res, ErrorCode.INVALID_SYSTEM_CATEGORY_NAME);
  }

  if (!image || !image.url) {
    return ApiResponse.error(res, ErrorCode.INVALID_SYSTEM_CATEGORY_IMAGE);
  }

  const category = await systemCategoryService.createSystemCategory({ name, image });
  return ApiResponse.success(res, category, "Tạo loại thức ăn thành công", 201);
});

/**
 * @desc    Update an existing system category
 * @route   PUT /api/v1/system-categories/:id
 * @access  Admin/Manager
 */
const updateSystemCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedCategory = await systemCategoryService.updateSystemCategory(id, req.body);

  if (!updatedCategory) {
    return ApiResponse.error(res, ErrorCode.SYSTEM_CATEGORY_NOT_FOUND);
  }

  return ApiResponse.success(res, updatedCategory, "Cập nhật loại thức ăn thành công", 200);
});

/**
 * @desc    Delete system category
 * @route   DELETE /api/v1/system-categories/:id
 * @access  Admin/Manager
 */
const deleteSystemCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await systemCategoryService.deleteSystemCategory(id);

  if (!deleted) {
    return ApiResponse.error(res, ErrorCode.SYSTEM_CATEGORY_NOT_FOUND);
  }

  return ApiResponse.success(res, null, "Xóa loại thức ăn thành công", 200);
});

module.exports = {
  getAllSystemCategory,
  getSystemCategory,
  createSystemCategory,
  updateSystemCategory,
  deleteSystemCategory,
};
