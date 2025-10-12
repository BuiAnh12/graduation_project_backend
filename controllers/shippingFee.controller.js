const {
  getAllShippingFeesService,
  createShippingFeeService,
  updateShippingFeeService,
  deleteShippingFeeService,
  calculateShippingFeeService,
} = require("../services/shippingFee.service");
const ApiResponse = require("../utils/apiResponse");

// ✅ Lấy tất cả mức phí ship
const getAllShippingFees = async (req, res) => {
  try {
    const data = await getAllShippingFeesService();
    return ApiResponse.success(res, data, "Lấy danh sách phí ship thành công");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

// ✅ Tạo mới mức phí ship
const createShippingFee = async (req, res) => {
  try {
    const data = await createShippingFeeService(req.body);
    return ApiResponse.success(
      res,
      data,
      "Tạo mức shipping mới thành công",
      201
    );
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

// ✅ Cập nhật mức phí ship
const updateShippingFee = async (req, res) => {
  try {
    const data = await updateShippingFeeService(req.params.feeId, req.body);
    return ApiResponse.success(res, data, "Cập nhật mức shipping thành công");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

// ✅ Xoá mức phí ship
const deleteShippingFee = async (req, res) => {
  try {
    await deleteShippingFeeService(req.params.feeId);
    return ApiResponse.success(res, null, "Xóa mức shipping thành công");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

// ✅ Tính phí ship
const calculateShippingFee = async (req, res) => {
  try {
    const fee = await calculateShippingFeeService(req.query.distanceKm);
    return ApiResponse.success(res, { fee }, "Tính phí shipping thành công");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

module.exports = {
  getAllShippingFees,
  createShippingFee,
  updateShippingFee,
  deleteShippingFee,
  calculateShippingFee,
};
