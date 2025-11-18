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
      console.log("Missing owner info:", {
        ownerName,
        email,
        phonenumber,
        gender,
        password,
      });
      throw ErrorCode.MISSING_REQUIRED_FIELDS;
    }

    // 2️⃣ Check email exists
    const existEmail = await Staff.findOne({ email }).session(session);
    if (existEmail) throw ErrorCode.EMAIL_EXISTS;

    // 3️⃣ Create account (dùng array để session hoạt động đúng)
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
    console.log("Account created:", account._id);

    // 4️⃣ Create staff owner (dùng array)
    const [staff] = await Staff.create(
      [
        {
          accountId: account._id,
          name: ownerName,
          email, // fix: dùng trực tiếp email string
          phonenumber,
          gender,
          role: StoreRoles.STORE_OWNER,
        },
      ],
      { session }
    );
    console.log("Staff created:", staff._id);

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
      console.log("Missing store info:", {
        name,
        description,
        address_full,
        location,
        systemCategoryId,
        avatarImage,
        coverImage,
        openHour,
        closeHour,
        ICFrontImage,
        ICBackImage,
        BusinessLicenseImage,
      });
      throw ErrorCode.MISSING_REQUIRED_FIELDS;
    }

    // 6️⃣ Create store (dùng array)
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
    console.log("Store created:", store._id);

    // 7️⃣ Commit transaction
    await session.commitTransaction();
    session.endSession();

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

  // ✅ Kiểm tra và cập nhật danh mục hệ thống (mảng ObjectId)
  if (Array.isArray(systemCategoryId)) {
    store.systemCategoryId = systemCategoryId;
  }

  await store.save();

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

  return {
    avatarImage: store.avatarImage,
    coverImage: store.coverImage,
  };
};

// Cập nhật địa chỉ
const updateStoreAddressService = async (storeId, userId, body) => {
  const { address_full, lat, lon } = body || {};

  // 1️⃣ Tìm store của user
  const store = await Store.findOne({ _id: storeId, owner: userId });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  // 2️⃣ Cập nhật địa chỉ
  if (address_full) store.address_full = address_full;

  // 3️⃣ Cập nhật toạ độ
  if (lat !== undefined && lon !== undefined) {
    store.location = {
      type: "Point",
      lat: lat.toString(),
      lon: lon.toString(),
    };
  }

  // 4️⃣ Lưu thay đổi
  await store.save();

  // 5️⃣ Trả về dữ liệu mới
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

  return {
    ICFrontImage: store.ICFrontImage,
    ICBackImage: store.ICBackImage,
    BusinessLicenseImage: store.BusinessLicenseImage,
  };
};

const getAllStoreService = async ({
  keyword,
  category,
  sort,
  limit,
  page,
  lat,
  lon,
}) => {
  let filterOptions = {};

  // filter by category
  if (category) {
    const categories = Array.isArray(category) ? category : category.split(",");
    filterOptions.systemCategoryId = { $in: categories };
  }  

  filterOptions.status = "approved"
  filterOptions.openStatus = "opened"

  // keyword search
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

  // distance filter
  if (lat && lon) {
    const latUser = parseFloat(lat);
    const lonUser = parseFloat(lon);

    const toRad = (v) => (v * Math.PI) / 180;
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * a;
    };

    stores = stores
      .map((store) => {
        if (store.location?.lat != null && store.location?.lon != null) {
          store.distance = calculateDistance(
            latUser,
            lonUser,
            store.location.lat,
            store.location.lon
          );
        } else {
          store.distance = Infinity;
        }
        return store;
      })
      .filter((store) => store.distance <= 70);
  }

  // sorting
  if (sort === "rating") {
    stores = stores.sort((a, b) => b.avgRating - a.avgRating);
  } else if (sort === "standout") {
    const storeOrders = await Order.aggregate([
      { $group: { _id: "$storeId", orderCount: { $sum: 1 } } },
    ]);

    stores = stores
      .map((store) => {
        const order = storeOrders.find(
          (o) => o._id.toString() === store._id.toString()
        );
        return { ...store, orderCount: order ? order.orderCount : 0 };
      })
      .sort((a, b) => b.orderCount - a.orderCount);
  } else if (sort === "name") {
    stores.sort((a, b) => a.name.localeCompare(b.name));
  }

  const totalItems = stores.length;

  // pagination
  if (limit && page) {
    const pageSize = parseInt(limit) || 10;
    const pageNumber = parseInt(page) || 1;
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginatedStores = stores.slice(
      (pageNumber - 1) * pageSize,
      pageNumber * pageSize
    );

    return {
      total: totalItems,
      totalPages,
      currentPage: pageNumber,
      pageSize,
      data: paginatedStores,
    };
  }

  return { total: totalItems, data: stores };
};

const getStoreInformationService = async (storeId) => {
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

  return {
    ...store,
    avgRating: storeRatings.length > 0 ? storeRatings[0].avgRating : 0,
    amountRating: storeRatings.length > 0 ? storeRatings[0].amountRating : 0,
  };
};

/**
 * Gets all dishes for a store and maps user preferences to them.
 *
 * @param {string} storeId - The ID of the store.
 * @param {object | null} userReference - The user's preference document or null.
 * @returns {Promise<Array<object>>} A list of dish objects.
 */
const getAllDishInStoreService = async (storeId, userReference = null) => {
  // 1. Create lookup sets from user preferences for O(1) checks.
  let prefSets = null;
  if (userReference) {
    console.log(userReference)
    // Helper to create a Set from an array of ObjectIds
    const toSet = (arr) => new Set(arr.map(id => id.toString()));

    prefSets = {
      // Prohibit
      allergy: toSet(userReference.allergy),
      // Warning
      dislike_food: toSet(userReference.dislike_food),
      dislike_taste: toSet(userReference.dislike_taste),
      dislike_cooking: toSet(userReference.dislike_cooking_method),
      dislike_culture: toSet(userReference.dislike_culture),
      // Like
      like_food: toSet(userReference.like_food),
      like_taste: toSet(userReference.like_taste),
      like_cooking: toSet(userReference.like_cooking_method),
      like_culture: toSet(userReference.like_culture),
    };
  }

  // 2. Fetch all dishes from the store.
  const dishes = await Dish.find({ storeId })
    .populate("categories image") // Keep original populates
    .lean(); // Use .lean() for high-performance reads

  // 3. Map dishes and apply suitability logic
  const processedDishes = dishes.map(dish => {
    let suitability = 'suitable';
    
    // This new object will hold only the tags relevant to the user
    const preferenceMatches = {
      allergy: [],
      warning: [],
      like: [],
    };

    if (prefSets) {
      // --- Check Food Tags (dishTags) ---
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

      // --- Check Taste Tags (tasteTags) ---
      for (const tagId of dish.tasteTags) {
        const tagIdStr = tagId.toString();
        if (prefSets.dislike_taste.has(tagIdStr)) {
          preferenceMatches.warning.push(tagId);
        } else if (prefSets.like_taste.has(tagIdStr)) {
          preferenceMatches.like.push(tagId);
        }
      }

      // --- Check Cooking Method Tags (cookingMethodtags) ---
      for (const tagId of dish.cookingMethodtags) {
        const tagIdStr = tagId.toString();
        if (prefSets.dislike_cooking.has(tagIdStr)) {
          preferenceMatches.warning.push(tagId);
        } else if (prefSets.like_cooking.has(tagIdStr)) {
          preferenceMatches.like.push(tagId);
        }
      }

      // --- Check Culture Tags (cultureTags) ---
      for (const tagId of dish.cultureTags) {
        const tagIdStr = tagId.toString();
        if (prefSets.dislike_culture.has(tagIdStr)) {
          preferenceMatches.warning.push(tagId);
        } else if (prefSets.like_culture.has(tagIdStr)) {
          preferenceMatches.like.push(tagId);
        }
      }

      // --- Determine final suitability ---
      if (preferenceMatches.allergy.length > 0) {
        suitability = 'prohibit';
      } else if (preferenceMatches.warning.length > 0) {
        suitability = 'warning';
      }
    }

    // --- Clean the output object ---
    // Destructure the dish to get all properties EXCEPT the large tag arrays
    const {
      dishTags,
      tasteTags,
      cookingMethodtags,
      cultureTags,
      ...restOfDish // Contains name, price, image, category, etc.
    } = dish;

    // Return the clean dish object + our new preference fields
    return {
      ...restOfDish,
      suitability,
      preferenceMatches, // The new object with only relevant tags
    };
  });

  return processedDishes;
};

const getDetailDishService = async (dishId) => {
  const dish = await Dish.findById(dishId).populate([
    { path: "category", select: "name" },
    { path: "image", select: "url" },
  ]);

  if (!dish) throw ErrorCode.DISH_NOT_FOUND;

  // find all topping group links for this dish
  const dishToppingGroups = await DishToppingGroup.find({
    dishId: dish._id,
  }).populate({ path: "toppingGroupId", select: "name" });

  // attach toppings for each group
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

// Handle store in admin site
const getAllStoresByStatusService = async (
  status,
  page = 1,
  limit = 10,
  search = "",
  sort = "name_asc" // mặc định sắp xếp theo tên A → Z
) => {
  const validStatuses = ["approved", "register", "blocked"];
  if (!validStatuses.includes(status)) {
    throw ErrorCode.INVALID_STORE_STATUS;
  }

  const skip = (page - 1) * limit;

  // Xây dựng query search
  const query = {
    status,
  };
  if (search && search.trim() !== "") {
    query.name = { $regex: search.trim(), $options: "i" }; // tìm gần đúng không phân biệt hoa thường
  }

  // Xây dựng sort option
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
      sortOption = { name: 1 }; // fallback
  }

  // Tổng số store theo query
  const totalStores = await Store.countDocuments(query);

  // Lấy danh sách store có phân trang, tìm kiếm, sắp xếp
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
};
