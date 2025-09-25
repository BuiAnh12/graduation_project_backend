const Dish = require("../models/dish.model");
const createError = require("../utils/createError");
const { getPaginatedData } = require("../utils/paging");
const mongoose = require("mongoose");
const redisCache = require("../utils/redisCaches");
const ErrorCode = require("../constants/errorCodes.enum")

const getDishByIdService = async (dishId) => {
  if (!dishId) throw ErrorCode.MISSING_REQUIRED_FIELDS

  const dish = await Dish.findById(dishId)
    .select("name price description stockStatus image category toppingGroups")
    .populate("toppingGroups", "name price")
    .populate("category", "_id name");

  if (!dish) throw ErrorCode.DISH_NOT_FOUND
  return dish;
};

const getDishesByStoreIdService = async (storeId, query) => {
  if (!storeId) throw ErrorCode.MISSING_REQUIRED_FIELDS

  const { name, limit, page } = query;

  const cacheKey = `dishes:store:${storeId}${name ? `:name=${name}` : ""}${
    limit ? `:limit=${limit}` : ""
  }${page ? `:page=${page}` : ""}`;

  const cached = await redisCache.get(cacheKey);
  if (cached) return { result: cached, fromCache: true };

  let filterOptions = { storeId: new mongoose.Types.ObjectId(storeId) };
  if (name) filterOptions.name = { $regex: name, $options: "i" };

  const result = await getPaginatedData(
    Dish,
    filterOptions,
    [
      { path: "category", select: "name" },
      {
        path: "toppingGroups",
        select: "name toppings",
        populate: { path: "toppings", select: "name price" },
      },
    ],
    limit,
    page
  );

  await redisCache.set(cacheKey, result);
  return { result, fromCache: false };
};

const createDishService = async (storeId, data) => {
  if (!storeId) throw ErrorCode.MISSING_REQUIRED_FIELDS
  if (!data.name || !data.price)
    throw ErrorCode.MISSING_REQUIRED_FIELDS

  const dish = new Dish({
    ...data,
    storeId: new mongoose.Types.ObjectId(storeId),
  });
  await dish.save();

  await redisCache.del(`dishes:store:${dish.storeId._id}`);
  return dish;
};

const changeDishStatusService = async (dishId) => {
  if (!dishId) throw ErrorCode.MISSING_REQUIRED_FIELDS

  const dish = await Dish.findById(dishId);
  if (!dish) throw ErrorCode.DISH_NOT_FOUND

  dish.stockStatus =
    dish.stockStatus === "AVAILABLE" ? "OUT_OF_STOCK" : "AVAILABLE";

  await dish.save();
  await redisCache.del(`dishes:store:${dish.storeId._id}`);
  return dish;
};

const updateDishService = async (dishId, data) => {
  if (!dishId) throw ErrorCode.MISSING_REQUIRED_FIELDS

  const dish = await Dish.findById(dishId);
  if (!dish) throw ErrorCode.DISH_NOT_FOUND

  Object.assign(dish, data);
  await dish.save();

  await redisCache.del(`dishes:store:${dish.storeId._id}`);
  return dish;
};

const deleteDishService = async (dishId) => {
  if (!dishId) throw ErrorCode.MISSING_REQUIRED_FIELDS

  const dish = await Dish.findByIdAndDelete(dishId);
  if (!dish) throw ErrorCode.DISH_NOT_FOUND

  await redisCache.del(`dishes:store:${dish.storeId._id}`);
  return dish;
};

module.exports = {
  getDishByIdService,
  getDishesByStoreIdService,
  createDishService,
  changeDishStatusService,
  updateDishService,
  deleteDishService,
};
