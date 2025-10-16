const Dish = require("../models/dishes.model");
const DishToppingGroup = require("../models/dish_topping_groups.model");
const ToppingGroup = require("../models/topping_groups.model");
const Topping = require("../models/toppings.model");
const createError = require("../utils/createError");
const { getPaginatedData } = require("../utils/paging");
const mongoose = require("mongoose");
// const redisCache = require("../utils/redisCaches");
const ErrorCode = require("../constants/errorCodes.enum");

const getDishByIdService = async (dishId) => {
  if (!dishId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const dish = await Dish.findById(dishId)
    .select("name price description stockStatus image category toppingGroups")
    .populate("toppingGroups", "name price")
    .populate("category", "_id name");

  if (!dish) throw ErrorCode.DISH_NOT_FOUND;
  return dish;
};

const getDishesByStoreIdService = async (storeId, query) => {
  if (!storeId) throw new Error("Missing storeId");

  const {
    name, // search theo tên
    category, // filter theo categoryId
    sortBy = "name", // sort theo name | price
    order = "asc", // asc | desc
    page = 1,
    limit = 10,
  } = query;

  // --- Filter ---
  const filter = { storeId: new mongoose.Types.ObjectId(storeId) };

  // Search theo tên món ăn
  if (name) {
    filter.name = { $regex: name, $options: "i" };
  }

  // Filter theo category
  if (category && mongoose.Types.ObjectId.isValid(category)) {
    filter.category = category;
  }

  // --- Sort setup ---
  const sort = {};
  const allowedSorts = ["name", "price", "createdAt"];
  sort[allowedSorts.includes(sortBy) ? sortBy : "name"] =
    order === "desc" ? -1 : 1;

  // --- Pagination ---
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // --- Truy vấn danh sách món ăn ---
  const dishes = await Dish.find(filter)
    .populate("category", "name")
    .populate("image")
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  // --- Lấy topping group cho từng dish ---
  const dishIds = dishes.map((d) => d._id);
  const dishToppingGroups = await DishToppingGroup.find({
    dishId: { $in: dishIds },
  })
    .populate({
      path: "topping_groups",
      select: "name onlyOnce",
    })
    .lean();

  // --- Map topping groups vào từng dish ---
  const toppingMap = {};
  dishToppingGroups.forEach((rel) => {
    if (!toppingMap[rel.dishId]) toppingMap[rel.dishId] = [];
    toppingMap[rel.dishId].push(rel.topping_groups);
  });

  const dishesWithToppings = dishes.map((dish) => ({
    ...dish,
    toppingGroups: toppingMap[dish._id] || [],
  }));

  // --- Meta ---
  const totalItems = await Dish.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / parseInt(limit));

  return {
    success: true,
    message: "Dishes retrieved successfully",
    data: dishesWithToppings,
    meta: {
      totalItems,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit),
      status: 200,
    },
  };
};

const createDishService = async (storeId, data) => {
  if (!storeId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (!data.name || !data.price) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const dish = new Dish({
    ...data,
    storeId: new mongoose.Types.ObjectId(storeId),
  });
  await dish.save();

  await redisCache.del(`dishes:store:${dish.storeId._id}`);
  return dish;
};

const changeDishStatusService = async (dishId) => {
  if (!dishId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const dish = await Dish.findById(dishId);
  if (!dish) throw ErrorCode.DISH_NOT_FOUND;

  dish.stockStatus =
    dish.stockStatus === "AVAILABLE" ? "OUT_OF_STOCK" : "AVAILABLE";

  await dish.save();
  await redisCache.del(`dishes:store:${dish.storeId._id}`);
  return dish;
};

const updateDishService = async (dishId, data) => {
  if (!dishId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const dish = await Dish.findById(dishId);
  if (!dish) throw ErrorCode.DISH_NOT_FOUND;

  Object.assign(dish, data);
  await dish.save();

  await redisCache.del(`dishes:store:${dish.storeId._id}`);
  return dish;
};

const deleteDishService = async (dishId) => {
  if (!dishId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const dish = await Dish.findByIdAndDelete(dishId);
  if (!dish) throw ErrorCode.DISH_NOT_FOUND;

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
