const Report = require("../models/reports.model");
const Reason = require("../models/reasons.model");
const Store = require("../models/stores.model");
const Dish = require("../models/dishes.model");
const Order = require("../models/orders.model")
const ErrorCode = require("../constants/errorCodes.enum");
const { redisCache, CACHE_TTL } = require("../utils/redisCaches");

// Reason
const getAllReasonService = async () => {
  const data = await Reason.find();
  return data;
};

const createReasonService = async (body) => {
  const { name, other } = body || {};
  if (!name || typeof name !== "string") {
    throw ErrorCode.INVALID_REASON_INFORMATION;
  }
  const exists = await Reason.findOne({ name });
  if (exists) {
    throw ErrorCode.REASON_ALREADY_EXISTS;
  }

  const newReason = await Reason.create({ name, other });

  return newReason;
};

const updateReasonService = async (id, payload) => {
  if (!id) throw ErrorCode.REASON_NOT_FOUND;

  const reason = await Reason.findById(id);
  if (!reason) throw ErrorCode.REASON_NOT_FOUND;

  const { name, other } = payload || {};

  // update name
  if (typeof name === "string" && name.trim() !== "" && name !== reason.name) {
    const exists = await Reason.findOne({ name });
    if (exists) {
      throw ErrorCode.REASON_ALREADY_EXISTS;
    }
    reason.name = name.trim();
  }

  // update other (boolean)
  if (typeof other === "boolean") {
    reason.other = other;
  }

  await reason.save();
  return reason;
};

const deleteReasonService = async (id) => {
  console.log(id);
  if (!id) {
    throw ErrorCode.REASON_NOT_FOUND;
  }

  const reason = await Reason.findById(id);
  if (!reason) {
    throw ErrorCode.REASON_NOT_FOUND;
  }

  const hasReport = await Report.exists({ reasonId: id });
  if (hasReport) {
    throw ErrorCode.CAN_NOT_DELETE_REASON_HAS_REPORT;
  }

  await Reason.findByIdAndDelete(id);

  return true;
};

// REPORT
const getAllReportService = async (query) => {
  const {
    reasonIds,
    status, // true | false
    search,
    sortBy = "createdAt",
    order = "desc",
    page = 1,
    limit = 10,
  } = query;

  const filter = {};

  // 🔹 filter theo nhiều reason
  if (reasonIds) {
    const reasonIdArray = Array.isArray(reasonIds)
      ? reasonIds
      : reasonIds.split(",");
    filter.reasonId = { $in: reasonIdArray };
  }

  // 🔹 filter theo status
  if (status === "true") filter.status = true;
  if (status === "false") filter.status = false;

  // 🔹 search theo name
  if (search) {
    filter.note = { $regex: search, $options: "i" };
  }

  const sort = {
    [sortBy]: order === "asc" ? 1 : -1,
  };

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const [reports, totalItems] = await Promise.all([
    Report.find(filter)
      .populate("userId", "name")
      .populate("storeId", "name")
      .populate("dishId", "name")
      .populate("reasonId", "name")
      .sort(sort)
      .skip(skip)
      .limit(limitNumber),

    Report.countDocuments(filter),
  ]);

  return {
    reports,
    meta: {
      totalItems,
      totalPages: Math.ceil(totalItems / limitNumber),
      currentPage: pageNumber,
      limit: limitNumber,
    },
  };
};

const getReportByIdService = async (id) => {
  if (!id) throw ErrorCode.REPORT_NOT_FOUND;

  const report = await Report.findById(id)
    .populate("userId", "name")
    .populate("storeId", "name")
    .populate("orderId")
    .populate("dishId", "name")
    .populate("reasonId", "name other");

  if (!report) throw ErrorCode.REPORT_NOT_FOUND;

  return report;
};

const createReportService = async (userId, payload) => {
  const { storeId, dishId, reasonId, orderId, note } = payload || {};

  /** ---------------- Validate input ---------------- */
  if (!storeId || !dishId || !reasonId || !orderId) {
    throw ErrorCode.INVALID_REPORT_INFORMATION;
  }

  /** ---------------- Check tồn tại ---------------- */
  const [store, dish, reason, order] = await Promise.all([
    Store.findById(storeId),
    Dish.findById(dishId),
    Reason.findById(reasonId),
    Order.findById(orderId),
  ]);

  if (!store) throw ErrorCode.STORE_NOT_FOUND;
  if (!dish) throw ErrorCode.DISH_NOT_FOUND;
  if (!reason) throw ErrorCode.REASON_NOT_FOUND;
  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  const existingReport = await Report.findOne({
    orderId: orderId,
    userId: userId,
    dishId: dishId,
  });
  if (existingReport) {
    // Bạn cần định nghĩa mã lỗi này trong file ErrorCode hoặc dùng mã lỗi chung
    throw {
      status: 400,
      message: "This dish has already been reported for this order.",
      code: "DISH_ALREADY_REPORTED",
    };
  }
  /** ---------------- Validate note theo reason ---------------- */
  let reportData = {
    userId,
    storeId,
    dishId,
    orderId,
    reasonId,
  };

  if (reason.other === true) {
    if (!note || typeof note !== "string" || !note.trim()) {
      throw ErrorCode.REPORT_NOTE_REQUIRED;
    }
    reportData.note = note.trim();
  }

  /** ---------------- Create report ---------------- */
  const report = await Report.create(reportData);

  /** ---------------- Populate ---------------- */
  const populatedReport = await Report.findById(report._id)
    .populate("storeId", "name")
    .populate("dishId", "name")
    .populate("reasonId", "name other");

  return populatedReport;
};

const updateReportStatusService = async (id, payload) => {
  if (!id) throw ErrorCode.REPORT_NOT_FOUND;
  const { status } = payload || {};
  if (typeof status !== "boolean") {
    throw ErrorCode.REPORT_STATUS_NOT_CORRECT;
  }

  const report = await Report.findById(id);
  if (!report) throw ErrorCode.REPORT_NOT_FOUND;

  report.status = status;
  await report.save();

  return report;
};

const deleteReportService = async (id) => {
  if (!id) {
    throw ErrorCode.REPORT_NOT_FOUND;
  }

  const report = await Report.findById(id);
  if (!report) {
    throw ErrorCode.REPORT_NOT_FOUND;
  }

  await Report.findByIdAndDelete(id);

  return true;
};

const submitReport = async (payload) => {
  
}

module.exports = {
  getAllReasonService,
  createReasonService,
  updateReasonService,
  deleteReasonService,
  getAllReportService,
  getReportByIdService,
  createReportService,
  updateReportStatusService,
  deleteReportService,
};
