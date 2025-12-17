const SystemCategory = require("../models/system_categories.model");
const Store = require("../models/stores.model");
const ErrorCode = require("../constants/errorCodes.enum");
const { redisCache, CACHE_TTL } = require("../utils/redisCaches");

// ✅ Helper to clear caches
const clearSystemCategoryCaches = async (id = null) => {
  // Clear the main lists
  await redisCache.del("system_categories:all");
  await redisCache.del("system_categories:with_count");
  
  // If an ID is provided, clear that specific detail
  if (id) {
    await redisCache.del(`system_category:${id}`);
  }
};

const getAllSystemCategoryService = async () => {
  const cacheKey = "system_categories:all";

  // Try to get from cache
  const cachedData = await redisCache.get(cacheKey);
  if (cachedData) return cachedData;

  const data = await SystemCategory.find().populate("image");

  await redisCache.set(cacheKey, data, CACHE_TTL.LONG);

  return data;
};

const getAllSystemCategoriesWithStoreCountService = async () => {
  const cacheKey = "system_categories:with_count";

  const cachedData = await redisCache.get(cacheKey);
  if (cachedData) return cachedData;

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

  await redisCache.set(cacheKey, categoriesWithCount, CACHE_TTL.MEDIUM);

  return categoriesWithCount;
};

const getSystemCategoryByIdService = async (id) => {
  if (!id) throw ErrorCode.SYSTEM_CATEGORY_NOT_FOUND;

  const cacheKey = `system_category:${id}`;
  
  // Try to get from cache
  const cachedData = await redisCache.get(cacheKey);
  if (cachedData) return cachedData;

  const category = await SystemCategory.findById(id).populate("image");
  if (!category) throw ErrorCode.SYSTEM_CATEGORY_NOT_FOUND;

  // Save to cache
  await redisCache.set(cacheKey, category, CACHE_TTL.LONG);

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

  const newCategory = await SystemCategory.create({ name, image });

  await clearSystemCategoryCaches();

  return newCategory;
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

  if (image) {
    category.image = image;
  }

  const updatedCategory = await category.save();

  await clearSystemCategoryCaches(id);

  return updatedCategory;
};

const deleteSystemCategoryService = async (id) => {
  if (!id) throw ErrorCode.SYSTEM_CATEGORY_NOT_FOUND;

  const storeCount = await Store.countDocuments({ systemCategoryId: id });
  if (storeCount > 0) {
    throw ErrorCode.CAN_NOT_DELETE_SYSTEM_CATEGORY();
  }

  const deleted = await SystemCategory.findByIdAndDelete(id);

  await clearSystemCategoryCaches(id);

  return deleted;
};

module.exports = {
  getAllSystemCategoryService,
  getAllSystemCategoriesWithStoreCountService,
  getSystemCategoryByIdService,
  createSystemCategoryService,
  updateSystemCategoryService,
  deleteSystemCategoryService,
};