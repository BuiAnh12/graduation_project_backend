const ErrorCode = require("../constants/errorCodes.enum");
const ShippingFee = require("../models/shipping_fees.model");

// 📌 Lấy toàn bộ phí ship (áp dụng chung cho mọi store)
const getAllShippingFeesService = async () => {
  const steps = await ShippingFee.find().sort({ fromDistance: 1 });
  return steps;
};

// 📌 Tạo mới 1 mức phí ship
const createShippingFeeService = async ({ fromDistance, feePerKm }) => {
  if (fromDistance === undefined || feePerKm === undefined)
    throw ErrorCode.MISSING_REQUIRED_FIELDS;

  if (feePerKm > 5000) throw ErrorCode.FEE_TOO_HIGH;

  const exists = await ShippingFee.findOne({ fromDistance });
  if (exists) throw ErrorCode.DUPLICATE_FROM_DISTANCE;

  const newFee = await ShippingFee.create({ fromDistance, feePerKm });
  return newFee;
};

// 📌 Cập nhật 1 mức phí ship
const updateShippingFeeService = async (feeId, { fromDistance, feePerKm }) => {
  const existing = await ShippingFee.findById(feeId);
  if (!existing) throw ErrorCode.SHIPPING_FEE_NOT_FOUND;

  // Check trùng fromDistance nếu thay đổi
  if (fromDistance !== undefined && fromDistance !== existing.fromDistance) {
    const duplicate = await ShippingFee.findOne({
      fromDistance,
      _id: { $ne: feeId },
    });
    if (duplicate) throw ErrorCode.DUPLICATE_FROM_DISTANCE;
  }

  if (feePerKm !== undefined && feePerKm > 5000) throw ErrorCode.FEE_TOO_HIGH;

  existing.fromDistance = fromDistance ?? existing.fromDistance;
  existing.feePerKm = feePerKm ?? existing.feePerKm;
  await existing.save();

  return existing;
};

// 📌 Xoá 1 mức phí ship
const deleteShippingFeeService = async (feeId) => {
  const fee = await ShippingFee.findById(feeId);
  if (!fee) throw ErrorCode.SHIPPING_FEE_NOT_FOUND;

  if (fee.fromDistance === 0) throw ErrorCode.CANNOT_DELETE_ZERO_STEP;

  await fee.deleteOne();
  return true;
};

// 📌 Tính phí ship dựa trên khoảng cách
const calculateShippingFeeService = async (distanceKm) => {
  if (!distanceKm || isNaN(distanceKm)) throw ErrorCode.INVALID_DISTANCE;

  const steps = await ShippingFee.find().sort({ fromDistance: 1 });
  if (!steps.length) throw ErrorCode.NO_SHIPPING_STEPS;

  let totalFee = 0;
  const distance = parseFloat(distanceKm);

  for (let i = 0; i < steps.length; i++) {
    const current = steps[i];
    const next = steps[i + 1];
    const start = current.fromDistance;
    const end = next ? next.fromDistance : distance;

    if (distance > start) {
      const segmentDistance = Math.min(distance, end) - start;
      totalFee += segmentDistance * current.feePerKm;
    }
  }

  return Math.round(totalFee);
};

module.exports = {
  getAllShippingFeesService,
  createShippingFeeService,
  updateShippingFeeService,
  deleteShippingFeeService,
  calculateShippingFeeService,
};
