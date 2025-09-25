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

const getVouchersByStore = async (req, res) => {
  try {
    const data = await getVouchersByStoreService(req.params.storeId);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, err);
  }
};

const getStoreVouchersByCustomer = async (req, res) => {
  try {
    const data = await getStoreVouchersCustomerService(req.params.storeId);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, err);
  }
};

const getDetailVoucher = async (req, res) => {
  try {
    const data = await getVoucherByIdService(req.params.voucherId);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, err);
  }
};

const createVoucher = async (req, res) => {
  try {
    const data = await createVoucherService(req.params.storeId, res.body);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, err);
  }
};

const updateVoucher = async (req, res) => {
  try {
    const data = await updateVoucherService(req.params.storeId, res.body);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, err);
  }
};

const deleteVoucher = async (req, res) => {
  try {
    const data = await deleteVoucherService(req.params.voucherId);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, err);
  }
};

const toggleVoucherActiveStatus = async (req, res) => {
  try {
    const data = await toggleVoucherActiveStatusService(
      req.params.storeId,
      res.body
    );
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, err);
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
