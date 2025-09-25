const mongoose = require("mongoose");
const Voucher = require("../models/vouchers.model");
const ErrorCode = require("../constants/errorCodes.enum");

// Store uses this service because it has not available voucher
const getVouchersByStoreService = async (storeId) => {
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  const allVouchers = await Voucher.find({ storeId }).populate("storeId");

  const usable = [];
  const upcoming = [];
  const expiredOrDisabled = [];

  allVouchers.forEach((voucher) => {
    const isWithinDate = voucher.startDate <= now && now <= endDate;
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

  const sortedVouchers = [...usable, ...upcoming, ...expiredOrDisabled];
  return sortedVouchers;
};

// Customer uses this service because it has not available voucher
const getStoreVouchersCustomerService = async (storeId) => {
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  const allVouchers = await Voucher.find({ storeId }).populate("storeId");

  const usable = [];
  const upcoming = [];
  const expiredOrDisabled = [];

  allVouchers.forEach((voucher) => {
    const isWithinDate = voucher.startDate <= now && now <= endDate;
    const notUsedUp = voucher.usageLimit
      ? voucher.usedCount < voucher.usageLimit
      : true;
    if (voucher.isActive && isWithinDate && notUsedUp) {
      usable.push(voucher);
    }
  });

  const sortedVouchers = [...usable];
  return sortedVouchers;
};

const createVoucherService = async (storeId, data) => {
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  const voucherData = {
    ...data,
    storeId,
  };

  const newVoucher = new Voucher(voucherData);
  const saved = await newVoucher.save();

  return saved;
};

const getVoucherByIdService = async (id) => {
  const voucher = await Voucher.findById(id).populate("storeId");
  if (!voucher) throw ErrorCode.VOUCHER_NOT_FOUND;
  return voucher;
};

const updateVoucherService = async (id, data) => {
  const updated = await Voucher.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!updated) throw ErrorCode.VOUCHER_NOT_FOUND;
  return updated;
};

const deleteVoucherService = async (id) => {
  const deleted = await Voucher.findByIdAndDelete(id);
  if (!deleted) throw ErrorCode.VOUCHER_NOT_FOUND;
  return deleted;
};

const toggleVoucherActiveStatusService = async (storeId, id) => {
  const voucher = await Voucher.findOne({ _id: id, storeId });
  if (!voucher) throw ErrorCode.VOUCHER_NOT_FOUND;

  voucher.isActive = !voucher.isActive;
  await voucher.save();

  return voucher;
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
