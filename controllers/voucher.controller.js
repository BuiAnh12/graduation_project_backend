const {
  getVouchersByStoreService,
  getStoreVouchersCustomerService,
  getVoucherByIdService,
  createVoucherService,
  updateVoucherService,
  deleteVoucherService,
  toggleVoucherActiveStatusService,
} = require("../services/voucher.service");

const ApiResponse = require("../utils/apiResponse");

// 🟩 Store side: Get all vouchers by store
const getVouchersByStore = async (req, res) => {
  try {
    const { vouchers, meta } = await getVouchersByStoreService(
      req.params.storeId,
      req.query
    );
    return ApiResponse.success(
      res,
      vouchers,
      "Vouchers fetched successfully",
      200,
      meta
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};
// 🟩 Customer side: Get usable vouchers
const getStoreVouchersByCustomer = async (req, res) => {
  try {
    const data = await getStoreVouchersCustomerService(req.params.storeId);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

// 🟩 Get voucher detail
const getDetailVoucher = async (req, res) => {
  try {
    const data = await getVoucherByIdService(req.params.voucherId);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

// 🟩 Create voucher
const createVoucher = async (req, res) => {
  try {
    const data = await createVoucherService(req.params.storeId, req.body);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

// 🟩 Update voucher
const updateVoucher = async (req, res) => {
  try {
    const data = await updateVoucherService(req.params.voucherId, req.body);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

// 🟩 Delete voucher
const deleteVoucher = async (req, res) => {
  try {
    const data = await deleteVoucherService(req.params.voucherId);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

// 🟩 Toggle voucher status
const toggleVoucherActiveStatus = async (req, res) => {
  try {
    const data = await toggleVoucherActiveStatusService(
      req.params.storeId,
      req.params.voucherId
    );
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

module.exports = {
  getVouchersByStore,
  getStoreVouchersByCustomer,
  getDetailVoucher,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  toggleVoucherActiveStatus,
};
