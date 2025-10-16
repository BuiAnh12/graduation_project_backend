const ToppingGroup = require("../models/topping_groups.model");
const Topping = require("../models/toppings.model");
const ErrorCode = require("../constants/errorCodes.enum");

// Lấy tất cả topping group theo store
const getAllToppingGroupByStoreService = async (storeId) => {
  if (!storeId) throw ErrorCode.INVALID_STORE_ID;

  return await ToppingGroup.find({ storeId })
    .populate("toppings") // lấy danh sách topping trong mỗi group
    .lean(); // trả về plain object (tối ưu)
};

// Lấy detail 1 topping group, kèm list toppings
const getToppingGroupDetailService = async (id) => {
  if (!id) throw ErrorCode.TOPPING_GROUP_NOT_FOUND;

  const group = await ToppingGroup.findById(id).populate("stores");
  if (!group) throw ErrorCode.TOPPING_GROUP_NOT_FOUND;

  const toppings = await Topping.find({ toppingGroupId: id });

  return {
    ...group.toObject(),
    toppings,
  };
};

// Tạo topping group mới
const createToppingGroupService = async (body) => {
  const { name, storeId, onlyOnce } = body || {};
  if (!name || !storeId) throw ErrorCode.INVALID_TOPPING_GROUP;

  const exists = await ToppingGroup.findOne({ name, storeId });
  if (exists) throw ErrorCode.TOPPING_GROUP_ALREADY_EXISTS;

  return await ToppingGroup.create({ name, storeId, onlyOnce });
};

// Cập nhật topping group
const updateToppingGroupService = async (id, payload) => {
  if (!id) throw ErrorCode.TOPPING_GROUP_NOT_FOUND;

  const group = await ToppingGroup.findById(id);
  if (!group) throw ErrorCode.TOPPING_GROUP_NOT_FOUND;

  const { name, storeId, onlyOnce } = payload || {};

  if (name && name !== group.name) {
    const exists = await ToppingGroup.findOne({ name, storeId: group.storeId });
    if (exists) throw ErrorCode.TOPPING_GROUP_ALREADY_EXISTS;
    group.name = name;
  }

  if (storeId) group.storeId = storeId;
  if (onlyOnce !== undefined) group.onlyOnce = onlyOnce;

  return await group.save();
};

// Xóa topping group
const deleteToppingGroupService = async (id) => {
  if (!id) throw ErrorCode.TOPPING_GROUP_NOT_FOUND;

  const toppingGroup = await ToppingGroup.findById(id);
  if (!toppingGroup) throw ErrorCode.TOPPING_GROUP_NOT_FOUND;

  // Xóa tất cả topping thuộc nhóm này
  await Topping.deleteMany({ toppingGroupId: id });

  // Sau đó xóa nhóm topping
  return await ToppingGroup.findByIdAndDelete(id);
};

module.exports = {
  getAllToppingGroupByStoreService,
  getToppingGroupDetailService,
  createToppingGroupService,
  updateToppingGroupService,
  deleteToppingGroupService,
};
