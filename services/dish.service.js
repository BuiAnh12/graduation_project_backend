const Dish = require("../models/dishes.model");
const DishToppingGroup = require("../models/dish_topping_groups.model");
const OrderItem = require("../models/order_items.model");
const CartItem = require("../models/cart_items.model");
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
  const filter = {
    storeId: new mongoose.Types.ObjectId(storeId),
    deleted: { $ne: true },
  };

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
    .populate("categories", "name")
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
      populate: {
        path: "toppings", // virtual trong ToppingGroupSchema
        select: "name price available", // chọn các field bạn cần
      },
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

const createDishService = async (
  storeId,
  {
    name,
    price,
    category,
    image,
    description,
    dishTags,
    tasteTags,
    cookingMethodtags,
    cultureTags,
    stockStatus,
    stockCount,
    toppingGroupIds = [], // danh sách topping group gửi từ FE
  }
) => {
  if (!name || !price || !storeId) {
    throw ErrorCode.MISSING_REQUIRED_FIELDS;
  }

  // 1️⃣ Tạo món ăn mới
  const dish = await Dish.create({
    name,
    price,
    category,
    storeId,
    image,
    description,
    dishTags,
    tasteTags,
    cookingMethodtags,
    cultureTags,
    stockStatus: stockStatus || "out_of_stock",
    stockCount: stockCount ?? 0,
  });

  // 2️⃣ Gắn topping groups nếu có
  if (toppingGroupIds.length > 0) {
    const mappings = toppingGroupIds.map((groupId) => ({
      dishId: dish._id,
      toppingGroupId: groupId,
    }));
    await DishToppingGroup.insertMany(mappings);
  }

  // 3️⃣ Populate đầy đủ thông tin (bao gồm topping groups)
  const fullDish = await Dish.findById(dish._id)
    .populate("category")
    .populate("storeId")
    .populate("image")
    .populate("dishTags")
    .populate("tasteTags")
    .populate("cookingMethodtags")
    .populate("cultureTags")
    .lean();

  const dishToppingGroups = await DishToppingGroup.find({ dishId: dish._id })
    .populate({
      path: "topping_groups",
      populate: { path: "toppings" },
    })
    .lean();

  fullDish.toppingGroups = dishToppingGroups.map((g) => g.topping_groups);

  return fullDish;
};

const changeDishStatusService = async (storeId, dishId) => {
  const dish = await Dish.findOne({ _id: dishId, storeId });
  if (!dish) throw ErrorCode.DISH_NOT_FOUND;

  dish.stockStatus =
    dish.stockStatus === "available" ? "out_of_stock" : "available";

  await dish.save();
  return dish;
};

const updateDishService = async (storeId, dishId, updateData) => {
  const {
    toppingGroupIds = [], // danh sách topping group mới gửi từ FE
    ...dishUpdateFields
  } = updateData;

  // 1️⃣ Cập nhật thông tin món ăn
  const dish = await Dish.findOneAndUpdate(
    { _id: dishId, storeId },
    dishUpdateFields,
    { new: true }
  )
    .populate("category")
    .populate("storeId")
    .populate("image")
    .populate("dishTags")
    .populate("tasteTags")
    .populate("cookingMethodtags")
    .populate("cultureTags");

  if (!dish) throw ErrorCode.DISH_NOT_FOUND;

  // 2️⃣ Cập nhật topping groups (nếu có truyền từ FE)
  if (Array.isArray(toppingGroupIds)) {
    // Xóa tất cả liên kết topping group cũ
    await DishToppingGroup.deleteMany({ dishId });

    // Loại bỏ trùng lặp ID
    const uniqueGroupIds = [...new Set(toppingGroupIds)];

    // Tạo liên kết mới
    if (uniqueGroupIds.length > 0) {
      const mappings = uniqueGroupIds.map((groupId) => ({
        dishId: dish._id,
        toppingGroupId: groupId,
      }));
      await DishToppingGroup.insertMany(mappings);
    }
  }

  // 3️⃣ Populate lại topping groups để trả về FE
  const dishToppingGroups = await DishToppingGroup.find({ dishId })
    .populate({
      path: "topping_groups",
      populate: { path: "toppings" },
    })
    .lean();

  const dishObj = dish.toObject();
  dishObj.toppingGroups = dishToppingGroups.map((d) => d.topping_groups);

  return dishObj;
};

const deleteDishService = async (storeId, dishId) => {
  // 1. Kiểm tra dish có tồn tại không
  const dish = await Dish.findOne({ _id: dishId, storeId });
  if (!dish) throw ErrorCode.DISH_NOT_FOUND;

  // 2. Kiểm tra xem dish có trong OrderItem hoặc CartItem không
  const usedInOrders = await OrderItem.exists({ dishId });
  const usedInCarts = await CartItem.exists({ dishId });

  // 3. Nếu đang được dùng → soft delete (set deleted = true)
  if (usedInOrders || usedInCarts) {
    await Dish.updateOne({ _id: dishId }, { $set: { deleted: true } });

    // Optional: vẫn xóa liên kết topping group
    await DishToppingGroup.deleteMany({ dishId });

    return {
      message: "Dish soft deleted (vì đang được dùng trong order/cart)",
      dishId,
      softDelete: true,
    };
  }

  // 4. Nếu không được dùng → xóa hẳn
  await Dish.deleteOne({ _id: dishId });
  await DishToppingGroup.deleteMany({ dishId });

  return {
    message: "Dish deleted permanently",
    dishId,
    softDelete: false,
  };
};

// --- GET DETAIL ---
const getDishDetailByStoreService = async (storeId, dishId) => {
  const dish = await Dish.findOne({ _id: dishId, storeId })
    .populate("category")
    .populate("storeId")
    .populate("image")
    .populate("dishTags")
    .populate("tasteTags")
    .populate("cookingMethodtags")
    .populate("cultureTags")
    .lean(); // dùng lean() để convert sang object, dễ thêm dữ liệu

  if (!dish) throw ErrorCode.NOT_FOUND;

  // Lấy danh sách topping group của món này
  const dishToppingGroups = await DishToppingGroup.find({ dishId })
    .populate({
      path: "topping_groups",
      populate: {
        path: "toppings", // populate toppings bên trong group
      },
    })
    .lean();

  // Gắn toppingGroups vào dish
  dish.toppingGroups = dishToppingGroups.map((d) => d.topping_groups);

  return dish;
};

module.exports = {
  getDishByIdService,
  getDishesByStoreIdService,
  createDishService,
  changeDishStatusService,
  updateDishService,
  deleteDishService,
  getDishDetailByStoreService,
};
