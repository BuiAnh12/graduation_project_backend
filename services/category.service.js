const Category = require("../models/categories.model");
const Dish = require("../models/dishes.model"); // Nếu sau này cần
const ErrorCode = require("../constants/errorCodes.enum");

// Lấy tất cả category
const getAllCategoryByStoreService = async (storeId) => {
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  return await Category.find({ storeId }).populate("stores");
};

// Lấy category theo ID
const getCategoryByIdService = async (id) => {
  if (!id) throw ErrorCode.CATEGORY_NOT_FOUND;

  const category = await Category.findById(id).populate("stores");
  if (!category) throw ErrorCode.CATEGORY_NOT_FOUND;

  return category;
};

// Tạo category mới
const createCategoryService = async (body) => {
  const { name, storeId } = body || {};
  if (!name || typeof name !== "string") {
    throw ErrorCode.INVALID_CATEGORY_NAME;
  }
  if (!storeId) throw ErrorCode.INVALID_STORE_ID;

  const exists = await Category.findOne({ name, storeId });
  if (exists) throw ErrorCode.CATEGORY_ALREADY_EXISTS;

  return await Category.create({ name, storeId });
};

// Cập nhật category
const updateCategoryService = async (id, payload) => {
  if (!id) throw ErrorCode.CATEGORY_NOT_FOUND;

  const category = await Category.findById(id);
  if (!category) throw ErrorCode.CATEGORY_NOT_FOUND;

  const { name, storeId } = payload || {};

  if (name && name !== category.name) {
    if (typeof name !== "string" || name.trim() === "") {
      throw ErrorCode.INVALID_CATEGORY_NAME;
    }
    const exists = await Category.findOne({ name, storeId: category.storeId });
    if (exists) throw ErrorCode.CATEGORY_ALREADY_EXISTS;
    category.name = name;
  }

  if (storeId) category.storeId = storeId;

  return await category.save();
};

// Xóa category
const deleteCategoryService = async (id) => {
  if (!id) throw ErrorCode.CATEGORY_NOT_FOUND;

  // Kiểm tra xem có món ăn nào thuộc category này không
  const dishExists = await Dish.exists({ category: id });
  if (dishExists) {
    throw {
      code: ErrorCode.CATEGORY_IN_USE,
      message: "Không thể xóa danh mục vì vẫn còn món ăn thuộc danh mục này.",
    };
  }

  // Nếu không có dish nào, mới xóa
  return await Category.findByIdAndDelete(id);
};

module.exports = {
  getAllCategoryByStoreService,
  getCategoryByIdService,
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
};
