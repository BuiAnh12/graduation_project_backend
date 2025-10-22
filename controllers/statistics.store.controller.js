const {
  getRevenueSummaryService,
  getDailyRevenueService,
  getRevenueByItemService,
  getRevenueByCategoryService,
  getOrderStatusRateService,
  getOrderSummaryStatsService,
  getOrdersOverTimeService,
  getOrderStatusDistributionService,
  getOrdersByTimeSlotService,
  getTopSellingItemsService,
  getRevenueContributionByItemService,
  getNewCustomersService,
  getReturningCustomerRateService,
  getAverageSpendingPerOrderService,
  getVoucherUsageSummaryService,
  getTopUsedVouchersService,
  getVoucherRevenueImpactService,
} = require("../services/statistics.store.service");
const ApiResponse = require("../utils/apiResponse");

// Revenue
const getRevenueSummary = async (req, res) => {
  try {
    const data = await getRevenueSummaryService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getRevenueByDay = async (req, res) => {
  try {
    const data = await getDailyRevenueService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getRevenueByItem = async (req, res) => {
  try {
    const data = await getRevenueByItemService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getRevenueByCategory = async (req, res) => {
  try {
    const data = await getRevenueByCategoryService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

// Order
const getOrderStatusRate = async (req, res) => {
  try {
    const data = await getOrderStatusRateService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getOrderSummaryStats = async (req, res) => {
  try {
    const data = await getOrderSummaryStatsService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getOrdersOverTime = async (req, res) => {
  try {
    const data = await getOrdersOverTimeService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getOrderStatusDistribution = async (req, res) => {
  try {
    const data = await getOrderStatusDistributionService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getOrdersByTimeSlot = async (req, res) => {
  try {
    const data = await getOrdersByTimeSlotService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

// Others
const getTopSellingItems = async (req, res) => {
  try {
    const data = await getTopSellingItemsService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getRevenueContributionByItem = async (req, res) => {
  try {
    const data = await getRevenueContributionByItemService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

// Customer
const getNewCustomers = async (req, res) => {
  try {
    const data = await getNewCustomersService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getReturningCustomerRate = async (req, res) => {
  try {
    const data = await getReturningCustomerRateService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getAverageSpendingPerOrder = async (req, res) => {
  try {
    const data = await getAverageSpendingPerOrderService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

// Voucher
const getVoucherUsageSummary = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return ApiResponse.error(res, { status: 401, message: "Unauthorized" });

    // Lấy query params from & to (nếu có)
    const { from, to } = req.query;

    // Truyền userId + from + to xuống service
    const data = await getVoucherUsageSummaryService(userId, from, to);

    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getTopUsedVouchers = async (req, res) => {
  try {
    const data = await getTopUsedVouchersService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getVoucherRevenueImpact = async (req, res) => {
  try {
    const data = await getVoucherRevenueImpactService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
module.exports = {
  getRevenueSummary,
  getRevenueByDay,
  getRevenueByItem,
  getRevenueByCategory,
  getOrderStatusRate,
  getOrderSummaryStats,
  getOrdersOverTime,
  getOrderStatusDistribution,
  getOrdersByTimeSlot,
  getTopSellingItems,
  getRevenueContributionByItem,
  getNewCustomers,
  getReturningCustomerRate,
  getAverageSpendingPerOrder,
  getVoucherUsageSummary,
  getTopUsedVouchers,
  getVoucherRevenueImpact,
};
