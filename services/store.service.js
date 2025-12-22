const mongoose = require("mongoose");
const SystemCategory = require("../models/system_categories.model");
const Category = require("../models/categories.model");
const ToppingGroup = require("../models/topping_groups.model");
const DishToppingGroup = require("../models/dish_topping_groups.model");
const Topping = require("../models/toppings.model");
const Store = require("../models/stores.model");
const Rating = require("../models/ratings.model");
const Dish = require("../models/dishes.model");
const Order = require("../models/orders.model");
const Staff = require("../models/staffs.model");
const Account = require("../models/accounts.model");
const ErrorCode = require("../constants/errorCodes.enum");
const { StoreRoles } = require("../constants/roles.enum");
const { redisCache, CACHE_TTL } = require("../utils/redisCaches");

// ✅ Helper: Clear caches when Store data changes
const clearStoreCaches = async (storeId) => {
  if (!storeId) return;
  const id = storeId.toString();

  // 1. Clear specific store details
  await redisCache.del(`store:info:${id}`);

  // 2. Clear store dish list (in case status changed or relevant info changed)
  await redisCache.del(`store:dishes:raw:${id}`);

  // 3. Clear global store lists (Sorting/Filtering might change)
  await redisCache.delByPattern(`stores:list:*`);
};

// Staff
const registerStoreService = async ({
  ownerName,
  email,
  phonenumber,
  password,
  gender,
  name,
  description,
  location,
  address_full,
  systemCategoryId,
  avatarImage,
  coverImage,
  openHour,
  closeHour,
  ICFrontImage,
  ICBackImage,
  BusinessLicenseImage,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1️⃣ Validate owner info
    if (!ownerName || !email || !phonenumber || !gender || !password) {
      throw ErrorCode.MISSING_REQUIRED_FIELDS;
    }

    // 2️⃣ Check email exists
    const existEmail = await Staff.findOne({ email }).session(session);
    if (existEmail) throw ErrorCode.EMAIL_EXISTS;

    // 3️⃣ Create account
    const [account] = await Account.create(
      [
        {
          password,
          isGoogleLogin: false,
          blocked: false,
        },
      ],
      { session }
    );

    // 4️⃣ Create staff owner
    const [staff] = await Staff.create(
      [
        {
          accountId: account._id,
          name: ownerName,
          email,
          phonenumber,
          gender,
          role: StoreRoles.STORE_OWNER,
        },
      ],
      { session }
    );

    // 5️⃣ Validate store info
    if (
      !name ||
      !description ||
      !address_full ||
      !location ||
      !Array.isArray(systemCategoryId) ||
      !avatarImage ||
      !coverImage ||
      !openHour ||
      !closeHour ||
      !ICFrontImage ||
      !ICBackImage ||
      !BusinessLicenseImage
    ) {
      throw ErrorCode.MISSING_REQUIRED_FIELDS;
    }

    // 6️⃣ Create store
    const [store] = await Store.create(
      [
        {
          name,
          description,
          address_full,
          location: {
            type: "Point",
            lat: location.coordinates[1].toString(),
            lon: location.coordinates[0].toString(),
          },
          systemCategoryId,
          owner: staff._id,
          avatarImage,
          coverImage,
          openHour,
          closeHour,
          ICFrontImage,
          ICBackImage,
          status: "register",
          BusinessLicenseImage,
          staff: staff._id,
        },
      ],
      { session }
    );

    // 7️⃣ Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    // 
    await redisCache.delByPattern(`stores:list:*`);

    return store;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Register store failed:", err);
    throw err;
  }
};

const checkStoreStatusService = async (storeId) => {
  const store = await Store.findById(storeId);

  if (!store) {
    throw ErrorCode.STORE_NOT_FOUND;
  }

  return store.status;
};

const getStoreInfoService = async (storeId) => {
  const store = await Store.findById(storeId)
    .select("-staff -owner")
    .populate("systemCategoryId", "name")
    .populate("avatarImage")
    .populate("coverImage")
    .populate("ICFrontImage")
    .populate("ICBackImage")
    .populate("BusinessLicenseImage");

  if (!store) {
    throw ErrorCode.STORE_NOT_FOUND;
  }

  return store;
};

const toggleOpenStatusService = async (storeId, userId) => {
  const store = await Store.findOne({ _id: storeId, owner: userId });

  if (!store) {
    throw ErrorCode.STORE_NOT_FOUND;
  }

  store.openStatus = store.openStatus === "opened" ? "closed" : "opened";
  await store.save();

  // 
  await clearStoreCaches(storeId);

  return store.openStatus;
};

// Update open & close hours
const updateOpenCloseHoursService = async (storeId, userId, data) => {
  const { openHour, closeHour } = data || {};

  if (!openHour || !closeHour) {
    throw {
      statusCode: 400,
      message: "Missing openHour or closeHour field.",
    };
  }

  const isValidHourFormat = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!isValidHourFormat(openHour) || !isValidHourFormat(closeHour)) {
    throw {
      statusCode: 400,
      message: "Invalid hour format. Must be HH:mm (e.g. 08:00, 18:30).",
    };
  }

  const store = await Store.findOne({ _id: storeId, owner: userId });
  if (!store) {
    throw ErrorCode.STORE_NOT_FOUND_OR_UNAUTHORIZED;
  }

  store.openHour = openHour;
  store.closeHour = closeHour;
  await store.save();

  // 
  await clearStoreCaches(storeId);

  return {
    openHour: store.openHour,
    closeHour: store.closeHour,
  };
};

const updateStoreInfoService = async (storeId, userId, data) => {
  const store = await Store.findOne({ _id: storeId, owner: userId });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const { name, description, systemCategoryId } = data;

  if (name) store.name = name;
  if (description) store.description = description;

  if (Array.isArray(systemCategoryId)) {
    store.systemCategoryId = systemCategoryId;
  }

  await store.save();

  // 
  await clearStoreCaches(storeId);

  return {
    name: store.name,
    description: store.description,
    systemCategoryId: store.systemCategoryId,
  };
};

const updateStoreImagesService = async (storeId, userId, body) => {
  const { avatarImage, coverImage } = body || {};

  const store = await Store.findOne({ _id: storeId, owner: userId });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  if (avatarImage) store.avatarImage = avatarImage;
  if (coverImage) store.coverImage = coverImage;

  await store.save();

  // 
  await clearStoreCaches(storeId);

  return {
    avatarImage: store.avatarImage,
    coverImage: store.coverImage,
  };
};

// Cập nhật địa chỉ
const updateStoreAddressService = async (storeId, userId, body) => {
  const { address_full, lat, lon } = body || {};

  const store = await Store.findOne({ _id: storeId, owner: userId });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  if (address_full) store.address_full = address_full;

  if (lat !== undefined && lon !== undefined) {
    store.location = {
      type: "Point",
      lat: lat.toString(),
      lon: lon.toString(),
    };
  }

  await store.save();

  //  (Location changes affect distance filters)
  await clearStoreCaches(storeId);

  return {
    address_full: store.address_full,
    location: store.location,
  };
};

const updateStorePaperWorkService = async (storeId, userId, body) => {
  const { ICFrontImage, ICBackImage, BusinessLicenseImage } = body || {};

  const store = await Store.findOne({ _id: storeId, owner: userId });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  if (ICFrontImage) store.ICFrontImage = ICFrontImage;
  if (ICBackImage) store.ICBackImage = ICBackImage;
  if (BusinessLicenseImage) store.BusinessLicenseImage = BusinessLicenseImage;

  await store.save();
  // Paperwork usually doesn't affect public cache immediately, but good to clear
  await redisCache.del(`store:info:${storeId}`);

  return {
    ICFrontImage: store.ICFrontImage,
    ICBackImage: store.ICBackImage,
    BusinessLicenseImage: store.BusinessLicenseImage,
  };
};

const getAllStoreService = async (params) => {
  const paramString = JSON.stringify(params, Object.keys(params).sort());
  const cacheKey = `stores:list:${paramString}`;

  const cachedData = await redisCache.get(cacheKey);
  if (cachedData) return cachedData;

  const {
    keyword,
    category,
    sort,
    limit,
    page,
    lat,
    lon,
  } = params;
  
  const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 10;

  let filterOptions = {};

  if (category) {
    const categories = Array.isArray(category) ? category : category.split(",");
    filterOptions.systemCategoryId = { $in: categories };
  }

  filterOptions.status = "approved";
  filterOptions.openStatus = "opened";

  if (keyword && keyword.trim()) {
    const kw = keyword.trim();

    const matchedSystemCategories = await SystemCategory.find({
      name: { $regex: kw, $options: "i" },
    }).select("_id");
    const systemCategoryIds = matchedSystemCategories.map((c) => c._id);

    const matchedCategories = await Category.find({
      name: { $regex: kw, $options: "i" },
    }).select("store");
    const storeIdsFromCategory = matchedCategories.map((c) => c.store);

    const matchedDishes = await Dish.find({
      name: { $regex: kw, $options: "i" },
    }).select("storeId");
    const storeIdsFromDishes = matchedDishes.map((d) => d.storeId);

    filterOptions.$or = [
      { name: { $regex: kw, $options: "i" } },
      { description: { $regex: kw, $options: "i" } },
      { systemCategoryId: { $in: systemCategoryIds } },
      { _id: { $in: storeIdsFromCategory } },
      { _id: { $in: storeIdsFromDishes } },
    ];
  }

  let stores = await Store.find(filterOptions)
    .populate({ path: "systemCategoryId", select: "name" })
    .populate({ path: "avatarImage", select: "url file_path" })
    .populate({ path: "coverImage", select: "url file_path" })
    .lean();

  if (keyword && keyword.trim()) {
    const kw = keyword.trim();
    const foundStoreIds = stores.map((s) => s._id);

    const matchingDishesDetails = await Dish.find({
      name: { $regex: kw, $options: "i" },
      storeId: { $in: foundStoreIds },
    })
      .select("name price description image storeId")
      .populate("image", "url file_path")
      .lean();

    stores = stores.map((store) => {
      const dishesForThisStore = matchingDishesDetails.filter(
        (d) => d.storeId.toString() === store._id.toString()
      );
      return {
        ...store,
        foundDishes: dishesForThisStore,
      };
    });
  }

  const storeRatings = await Rating.aggregate([
    {
      $group: {
        _id: "$storeId",
        avgRating: { $avg: "$ratingValue" },
        amountRating: { $sum: 1 },
      },
    },
  ]);

  stores = stores.map((store) => {
    const rating = storeRatings.find(
      (r) => r._id.toString() === store._id.toString()
    );
    return {
      ...store,
      avgRating: rating ? rating.avgRating : 0,
      amountRating: rating ? rating.amountRating : 0,
    };
  });

  if (lat && lon) {
    const latUser = parseFloat(lat);
    const lonUser = parseFloat(lon);
    const toRad = (v) => (v * Math.PI) / 180;
    
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; 
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * a;
    };

    stores = stores
      .map((store) => {
        if (store.location?.lat != null && store.location?.lon != null) {
          store.distance = calculateDistance(latUser, lonUser, store.location.lat, store.location.lon);
        } else {
          store.distance = Infinity;
        }
        return store;
      })
      .filter((store) => store.distance <= 70);
  }

  if (sort === "rating") {
    stores = stores.sort((a, b) => b.avgRating - a.avgRating);
  } else if (sort === "standout") {
    const storeOrders = await Order.aggregate([
      { $group: { _id: "$storeId", orderCount: { $sum: 1 } } },
    ]);
    stores = stores
      .map((store) => {
        const order = storeOrders.find((o) => o._id.toString() === store._id.toString());
        return { ...store, orderCount: order ? order.orderCount : 0 };
      })
      .sort((a, b) => b.orderCount - a.orderCount);
  } else if (sort === "name") {
    stores.sort((a, b) => a.name.localeCompare(b.name));
  }

  const totalItems = stores.length;
  const totalPages = Math.ceil(totalItems / limitNumber);
  
  const startIndex = (pageNumber - 1) * limitNumber;
  const endIndex = pageNumber * limitNumber;
  const paginatedStores = stores.slice(startIndex, endIndex);
  const result = {
    total: totalItems,
    totalPages: totalPages,
    page: pageNumber,
    limit: limitNumber,
    data: paginatedStores,
  };

  await redisCache.set(cacheKey, result, CACHE_TTL.MEDIUM);

  return result;
};

const getStoreInformationService = async (storeId) => {
  const cacheKey = `store:info:${storeId}`;

  const cachedData = await redisCache.get(cacheKey);
  if (cachedData) return cachedData;

  const store = await Store.findById(storeId)
    .populate({ path: "systemCategoryId", select: "name" })
    .populate({ path: "avatarImage", select: "url file_path" })
    .populate({ path: "coverImage", select: "url file_path" })
    .lean();
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeRatings = await Rating.aggregate([
    { $match: { store: store._id } },
    {
      $group: {
        _id: "$storeId",
        avgRating: { $avg: "$ratingValue" },
        amountRating: { $sum: 1 },
      },
    },
  ]);

  const result = {
    ...store,
    avgRating: storeRatings.length > 0 ? storeRatings[0].avgRating : 0,
    amountRating: storeRatings.length > 0 ? storeRatings[0].amountRating : 0,
  };

  await redisCache.set(cacheKey, result, CACHE_TTL.MEDIUM);

  return result;
};

const getAllDishInStoreService = async (storeId, userReference = null) => {
  const cacheKey = `store:dishes:raw:${storeId}`;
  
  let dishes = await redisCache.get(cacheKey);

  if (!dishes) {
    dishes = await Dish.find({ storeId, stockStatus: "available" })
      .populate("categories image") 
      .lean();

    await redisCache.set(cacheKey, dishes, CACHE_TTL.MEDIUM);
  }

  let prefSets = null;
  if (userReference) {
    const toSet = (arr) => new Set(arr.map(id => id.toString()));

    prefSets = {
      allergy: toSet(userReference.allergy),
      dislike_food: toSet(userReference.dislike_food),
      dislike_taste: toSet(userReference.dislike_taste),
      dislike_cooking: toSet(userReference.dislike_cooking_method),
      dislike_culture: toSet(userReference.dislike_culture),
      like_food: toSet(userReference.like_food),
      like_taste: toSet(userReference.like_taste),
      like_cooking: toSet(userReference.like_cooking_method),
      like_culture: toSet(userReference.like_culture),
    };
  }

  const processedDishes = dishes.map(dish => {
    let suitability = 'suitable';
    
    const preferenceMatches = {
      allergy: [],
      warning: [],
      like: [],
    };

    if (prefSets) {
      for (const tagId of dish.dishTags) {
        const tagIdStr = tagId.toString();
        if (prefSets.allergy.has(tagIdStr)) {
          preferenceMatches.allergy.push(tagId);
        } else if (prefSets.dislike_food.has(tagIdStr)) {
          preferenceMatches.warning.push(tagId);
        } else if (prefSets.like_food.has(tagIdStr)) {
          preferenceMatches.like.push(tagId);
        }
      }

      for (const tagId of dish.tasteTags) {
        const tagIdStr = tagId.toString();
        if (prefSets.dislike_taste.has(tagIdStr)) {
          preferenceMatches.warning.push(tagId);
        } else if (prefSets.like_taste.has(tagIdStr)) {
          preferenceMatches.like.push(tagId);
        }
      }

      for (const tagId of dish.cookingMethodtags) {
        const tagIdStr = tagId.toString();
        if (prefSets.dislike_cooking.has(tagIdStr)) {
          preferenceMatches.warning.push(tagId);
        } else if (prefSets.like_cooking.has(tagIdStr)) {
          preferenceMatches.like.push(tagId);
        }
      }

      for (const tagId of dish.cultureTags) {
        const tagIdStr = tagId.toString();
        if (prefSets.dislike_culture.has(tagIdStr)) {
          preferenceMatches.warning.push(tagId);
        } else if (prefSets.like_culture.has(tagIdStr)) {
          preferenceMatches.like.push(tagId);
        }
      }

      if (preferenceMatches.allergy.length > 0) {
        suitability = 'prohibit';
      } else if (preferenceMatches.warning.length > 0) {
        suitability = 'warning';
      }
    }

    const {
      dishTags,
      tasteTags,
      cookingMethodtags,
      cultureTags,
      ...restOfDish 
    } = dish;

    return {
      ...restOfDish,
      suitability,
      preferenceMatches, 
    };
  });

  return processedDishes;
};

const getDetailDishService = async (dishId) => {
  const dish = await Dish.findOne({ _id: dishId, stockStatus: "available" }).populate([
    { path: "category", select: "name" },
    { path: "image", select: "url" },
  ]);

  if (!dish) throw ErrorCode.DISH_NOT_FOUND;

  const dishToppingGroups = await DishToppingGroup.find({
    dishId: dish._id,
  }).populate({ path: "toppingGroupId", select: "name onlyOnce" });

  const toppingGroupsWithToppings = await Promise.all(
    dishToppingGroups.map(async (link) => {
      const group = link.toppingGroupId;
      if (!group) return null;

      const toppings = await Topping.find({ toppingGroupId: group._id }).select(
        "name price"
      );
      return { ...group.toObject(), toppings };
    })
  );

  return {
    ...dish.toObject(),
    toppingGroups: toppingGroupsWithToppings.filter(Boolean),
  };
};

const getAllStoresByStatusService = async (
  status,
  page = 1,
  limit = 10,
  search = "",
  sort = "name_asc"
) => {
  const validStatuses = ["approved", "register", "blocked"];
  if (!validStatuses.includes(status)) {
    throw ErrorCode.INVALID_STORE_STATUS;
  }

  const skip = (page - 1) * limit;

  const query = {
    status,
  };
  if (search && search.trim() !== "") {
    query.name = { $regex: search.trim(), $options: "i" };
  }

  let sortOption = {};
  switch (sort) {
    case "name_asc":
      sortOption = { name: 1 };
      break;
    case "name_desc":
      sortOption = { name: -1 };
      break;
    case "id_asc":
      sortOption = { _id: 1 };
      break;
    case "id_desc":
      sortOption = { _id: -1 };
      break;
    default:
      sortOption = { name: 1 };
  }

  const totalStores = await Store.countDocuments(query);

  const stores = await Store.find(query)
    .populate("owner", "name email")
    .populate("system_categories", "name")
    .populate("avatarImage coverImage", "url")
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(totalStores / limit);

  return {
    stores,
    totalStores,
    totalPages,
    currentPage: page,
  };
};

const approveStoreService = async (storeId) => {
  const store = await Store.findById(storeId);
  if (!store) {
    throw ErrorCode.STORE_NOT_FOUND;
  }

  if (store.status !== "register") {
    throw ErrorCode.INVALID_STATUS_TO_CHANGE;
  }

  store.status = "approved";
  await store.save();

  //  (Approved stores now appear in public lists)
  await clearStoreCaches(storeId);

  return {
    storeId: storeId,
    status: store.status,
  };
};

const blockStoreService = async (storeId) => {
  const store = await Store.findById(storeId);
  if (!store) {
    throw ErrorCode.STORE_NOT_FOUND;
  }

  if (store.status !== "approved") {
    throw ErrorCode.INVALID_STATUS_TO_CHANGE;
  }

  store.status = "blocked";
  await store.save();

  // 
  await clearStoreCaches(storeId);

  return {
    storeId: storeId,
    status: store.status,
  };
};

const unblockStoreService = async (storeId) => {
  const store = await Store.findById(storeId);
  if (!store) {
    throw {
      statusCode: 404,
      message: "Store not found.",
    };
  }

  if (store.status !== "blocked") {
    throw {
      statusCode: 400,
      message: "Only stores with status 'blocked' can be unblocked.",
    };
  }

  store.status = "approved";
  await store.save();

  // 
  await clearStoreCaches(storeId);

  return {
    message: "Store unblocked successfully.",
    status: store.status,
  };
};

const getStoreInformationDetailService = async (storeId) => {
  const store = await Store.findById(storeId)
    .populate({ path: "owner", select: "name email phonenumber role" })
    .populate({ path: "systemCategoryId", select: "name" })
    .populate({ path: "avatarImage", select: "url file_path" })
    .populate({ path: "coverImage", select: "url file_path" })
    .populate({ path: "ICFrontImage", select: "url file_path" })
    .populate({ path: "ICBackImage", select: "url file_path" })
    .populate({ path: "BusinessLicenseImage", select: "url file_path" })
    .lean();
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  return store;
};

const toggleStoreOpenNCloseStatus = async () => {
  const mock_store = await Store.findById("68f30cbea2bca94aa9fd19c7")
  if  (mock_store.openStatus == 'closed') {
    mock_store.openStatus = 'opened'
  }
  else {
    mock_store.openStatus = 'closed'
  }
  mock_store.save()
  
  // 
  await clearStoreCaches(mock_store._id);
  
  return mock_store
}

module.exports = {
  registerStoreService,
  getAllStoreService,
  getStoreInformationService,
  getAllDishInStoreService,
  getDetailDishService,
  checkStoreStatusService,
  getStoreInfoService,
  toggleOpenStatusService,
  updateOpenCloseHoursService,
  updateStoreInfoService,
  updateStoreImagesService,
  updateStoreAddressService,
  updateStorePaperWorkService,
  getAllStoresByStatusService,
  approveStoreService,
  blockStoreService,
  unblockStoreService,
  getStoreInformationDetailService,
  toggleStoreOpenNCloseStatus,
};