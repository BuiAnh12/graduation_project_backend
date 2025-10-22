const mongoose = require("mongoose");
const Voucher = require("../models/vouchers.model");
const Store = require("../models/stores.model");
const ErrorCode = require("../constants/errorCodes.enum");

// Store uses this service because it has not available voucher
const getVouchersByStoreService = async (storeId, query) => {
  const {
    search, // search theo code
    type, // filter theo type
    stackable, // true | false | all
    active, // true | false | all
    sortBy = "createdAt",
    order = "desc",
    page = 1,
    limit = 10,
  } = query;

  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  const store = await Store.findById(storeId);
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  // --- Base filter ---
  const filter = { storeId };

  // --- Search theo code ---
  if (search) {
    filter.code = { $regex: search, $options: "i" };
  }

  // --- Filter theo type ---
  if (type) {
    filter.discountType = type;
  }

  // --- Filter theo stackable ---
  if (stackable === "true") {
    filter.isStackable = true;
  } else if (stackable === "false") {
    filter.isStackable = false;
  }

  // --- Filter theo isActive ---
  if (active === "true") {
    filter.isActive = true;
  } else if (active === "false") {
    filter.isActive = false;
  }

  // --- Sort setup ---
  const sort = {};
  sort[sortBy] = order === "asc" ? 1 : -1;

  // --- Pagination setup ---
  const skip = (page - 1) * limit;

  // --- Lấy toàn bộ voucher ---
  let vouchers = await Voucher.find(filter).populate("storeId").sort(sort);

  // --- Ưu tiên voucher đang active trước ---
  vouchers.sort((a, b) => {
    if (a.isActive === b.isActive) return 0;
    return a.isActive ? -1 : 1; // true lên trước
  });

  // --- Phân loại usable / upcoming / expired ---
  const now = new Date();
  const usable = [];
  const upcoming = [];
  const expiredOrDisabled = [];

  vouchers.forEach((voucher) => {
    const isWithinDate = voucher.startDate <= now && now <= voucher.endDate;
    const notUsedUp = voucher.usageLimit
      ? voucher.usedCount < voucher.usageLimit
      : true;

    if (voucher.isActive && isWithinDate && notUsedUp) {
      usable.push(voucher);
    } else if (voucher.isActive && voucher.startDate > now) {
      upcoming.push(voucher);
    } else {
      expiredOrDisabled.push(voucher);
    }
  });

  const allVouchers = [...usable, ...upcoming, ...expiredOrDisabled];

  const totalItems = allVouchers.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedVouchers = allVouchers.slice(skip, skip + parseInt(limit));

  return {
    vouchers: paginatedVouchers,
    meta: {
      totalItems,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit),
    },
  };
};
// Customer uses this service because it has not available voucher
const getStoreVouchersCustomerService = async (storeId) => {
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  const allVouchers = await Voucher.find({ storeId }).populate("storeId");

  const usable = [];
  const upcoming = [];
  const expiredOrDisabled = [];

  const now = new Date(); // <-- define current time

  allVouchers.forEach((voucher) => {
    const startDate = voucher.startDate ? new Date(voucher.startDate) : null;
    const endDate = voucher.endDate ? new Date(voucher.endDate) : null;

    const isWithinDate =
      (!startDate || now >= startDate) && (!endDate || now <= endDate);

    const notUsedUp = voucher.usageLimit
      ? voucher.usedCount < voucher.usageLimit
      : true;

    if (voucher.isActive && isWithinDate && notUsedUp) {
      usable.push(voucher);
    } else if (startDate && now < startDate) {
      upcoming.push(voucher);
    } else {
      expiredOrDisabled.push(voucher);
    }
  });

  // Sort usable vouchers by start date (optional)
  const sortedVouchers = usable.sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate)
  );

  return sortedVouchers;
};


const createVoucherService = async (storeId, data) => {
  const store = await Store.findById(storeId);
  if (!store) throw ErrorCode.NOT_FOUND("Store not found");

  // Bỏ qua type và isStackable nếu không gửi
  const voucher = new Voucher({
    storeId,
    code: data.code,
    description: data.description,
    discountType: data.discountType,
    discountValue: data.discountValue,
    maxDiscount: data.maxDiscount,
    minOrderAmount: data.minOrderAmount,
    startDate: data.startDate,
    endDate: data.endDate,
    usageLimit: data.usageLimit,
    userLimit: data.userLimit,
    // isStackable và type dùng default
  });

  await voucher.save();
  return voucher;
};

// 🟩 Lấy voucher theo ID
const getVoucherByIdService = async (id) => {
  const voucher = await Voucher.findById(id).populate("storeId");
  if (!voucher) throw ErrorCode.VOUCHER_NOT_FOUND;
  return voucher;
};

// 🟩 Cập nhật voucher
const updateVoucherService = async (id, data) => {
  const voucher = await Voucher.findById(id);
  if (!voucher) throw ErrorCode.VOUCHER_NOT_FOUND;

  // Nếu đổi code → check trùng trong cùng store
  if (data.code && data.code !== voucher.code) {
    const existCode = await Voucher.findOne({
      storeId: voucher.storeId,
      code: data.code,
      _id: { $ne: id },
    });
    if (existCode) throw ErrorCode.VOUCHER_CODE_EXISTS;
  }

  const updated = await Voucher.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  return updated;
};

// 🟩 Xóa voucher
const deleteVoucherService = async (id) => {
  const deleted = await Voucher.findByIdAndDelete(id);
  if (!deleted) throw ErrorCode.VOUCHER_NOT_FOUND;
  return { message: "Voucher deleted successfully" };
};

// 🟩 Bật/tắt voucher (toggle isActive)
const toggleVoucherActiveStatusService = async (storeId, id) => {
  const voucher = await Voucher.findOne({ _id: id, storeId });
  if (!voucher) throw ErrorCode.VOUCHER_NOT_FOUND;

  voucher.isActive = !voucher.isActive;
  await voucher.save();

  return {
    message: `Voucher is now ${voucher.isActive ? "active" : "inactive"}`,
    isActive: voucher.isActive,
  };
};

module.exports = {
  getVouchersByStoreService,
  getStoreVouchersCustomerService,
  createVoucherService,
  getVoucherByIdService,
  updateVoucherService,
  toggleVoucherActiveStatusService,
  deleteVoucherService,
};
