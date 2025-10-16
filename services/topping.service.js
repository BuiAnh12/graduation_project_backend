const Topping = require("../models/toppings.model");
const ToppingGroup = require("../models/topping_groups.model");
const ErrorCode = require("../constants/errorCodes.enum");

// Lấy tất cả toppings theo group
const getAllToppingsByGroupService = async (toppingGroupId) => {
  if (!toppingGroupId) throw ErrorCode.INVALID_TOPPING_GROUP;

  return await Topping.find({ toppingGroupId }).populate("topping_groups");
};

// Lấy tất cả toppings theo storeId
const getAllToppingsByStoreService = async (storeId) => {
  if (!storeId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  // Lấy tất cả nhóm topping thuộc cửa hàng
  const groups = await ToppingGroup.find({ storeId });
  if (!groups.length) return [];

  const groupIds = groups.map((g) => g._id);

  // Lấy toppings theo danh sách groupId
  const toppings = await Topping.find({
    toppingGroupId: { $in: groupIds },
  }).populate("topping_groups"); // chỉ populate group, không lấy store

  return toppings;
};
// Lấy chi tiết topping
const getToppingByIdService = async (id) => {
  if (!id) throw ErrorCode.TOPPING_NOT_FOUND;

  const topping = await Topping.findById(id).populate("topping_groups");
  if (!topping) throw ErrorCode.TOPPING_NOT_FOUND;

  return topping;
};

// Tạo topping mới
const createToppingService = async (body) => {
  const { name, price, toppingGroupId } = body || {};
  if (!name || price === undefined || !toppingGroupId)
    throw ErrorCode.INVALID_TOPPING;

  // Kiểm tra toppingGroupId có tồn tại
  const group = await ToppingGroup.findById(toppingGroupId);
  if (!group) throw ErrorCode.TOPPING_GROUP_NOT_FOUND;

  return await Topping.create({ name, price, toppingGroupId });
};

// Cập nhật topping
const updateToppingService = async (id, payload) => {
  if (!id) throw ErrorCode.TOPPING_NOT_FOUND;

  const topping = await Topping.findById(id);
  if (!topping) throw ErrorCode.TOPPING_NOT_FOUND;

  const { name, price, toppingGroupId } = payload || {};

  if (name) topping.name = name;
  if (price !== undefined) topping.price = price;
  if (toppingGroupId) {
    const group = await ToppingGroup.findById(toppingGroupId);
    if (!group) throw ErrorCode.TOPPING_GROUP_NOT_FOUND;
    topping.toppingGroupId = toppingGroupId;
  }

  return await topping.save();
};

// Xóa topping
const deleteToppingService = async (id) => {
  if (!id) throw ErrorCode.TOPPING_NOT_FOUND;

  return await Topping.findByIdAndDelete(id);
};

module.exports = {
  getAllToppingsByGroupService,
  getToppingByIdService,
  createToppingService,
  updateToppingService,
  deleteToppingService,
};
