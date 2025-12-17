const SystemCategory = require("../models/system_categories.model");
const Store = require("../models/stores.model");
const ErrorCode = require("../constants/errorCodes.enum");
const {redisCache, CACHE_TTL} = require("../utils/redisCaches"); 

const getAllSystemCategoryService = async () => {
  const cacheKey = "system_categories:all";

  // Try to get from cache
  const cachedData = await redisCache.get(cacheKey);
  if (cachedData) return cachedData;
  const data = await SystemCategory.find().populate("image");

  // Save to cache
  await redisCache.set(cacheKey, data, CACHE_TTL.LONG);

  return data;
};

const getAllSystemCategoriesWithStoreCountService = async () => {
  // Lấy tất cả system categories
  const categories = await SystemCategory.find().populate("image");

  // Duyệt từng category, đếm số store gán category đó
  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      const storeCount = await Store.countDocuments({
        systemCategoryId: category._id,
      });

      return {
        _id: category._id,
        name: category.name,
        image: category.image,
        storeCount,
      };
    })
  );

  return categoriesWithCount;
};

const getSystemCategoryByIdService = async (id) => {
  if (!id) throw ErrorCode.SYSTEM_CATEGORY_NOT_FOUND;

  const category = await SystemCategory.findById(id).populate("image");
  if (!category) throw ErrorCode.SYSTEM_CATEGORY_NOT_FOUND;

  return category;
};

const createSystemCategoryService = async (body) => {
  const { name, image } = body || {};
  if (!name || typeof name !== "string") {
    throw ErrorCode.INVALID_SYSTEM_CATEGORY_NAME;
  }
  if (!image) {
    throw ErrorCode.INVALID_SYSTEM_CATEGORY_IMAGE;
  }
  const exists = await SystemCategory.findOne({ name });
  if (exists) {
    throw ErrorCode.SYSTEM_CATEGORY_ALREADY_EXISTS;
  }

  return await SystemCategory.create({ name, image });
};

const updateSystemCategoryService = async (id, payload) => {
  if (!id) throw ErrorCode.SYSTEM_CATEGORY_NOT_FOUND;

  const category = await SystemCategory.findById(id);
  if (!category) throw ErrorCode.SYSTEM_CATEGORY_NOT_FOUND;

  const { name, image } = payload || {};

  // Nếu đổi tên, kiểm tra hợp lệ và không trùng
  if (name && name !== category.name) {
    if (typeof name !== "string" || name.trim() === "") {
      throw ErrorCode.INVALID_SYSTEM_CATEGORY_NAME;
    }
    const exists = await SystemCategory.findOne({ name });
    if (exists) {
      throw ErrorCode.SYSTEM_CATEGORY_ALREADY_EXISTS;
    }
    category.name = name;
  }

  // Nếu đổi image
  if (image) {
    category.image = image;
  }

  return await category.save();
};
const deleteSystemCategoryService = async (id) => {
  if (!id) throw ErrorCode.SYSTEM_CATEGORY_NOT_FOUND;

  const storeCount = await Store.countDocuments({ systemCategoryId: id });
  if (storeCount > 0) {
    throw ErrorCode.CAN_NOT_DELETE_SYSTEM_CATEGORY();
  }

  return await SystemCategory.findByIdAndDelete(id);
};

module.exports = {
  getAllSystemCategoryService,
  getAllSystemCategoriesWithStoreCountService,
  getSystemCategoryByIdService,
  createSystemCategoryService,
  updateSystemCategoryService,
  deleteSystemCategoryService,
};
