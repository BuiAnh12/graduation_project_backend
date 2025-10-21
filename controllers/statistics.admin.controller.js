const {
  getDashboardSummaryService,
  getStoreSummaryService,
  getUserSummaryService,
  getShipperSummaryService,
} = require("../services/statistics.admin.service");
const ApiResponse = require("../utils/apiResponse");

// Revenue
const getDashboardSummary = async (req, res) => {
  try {
    const data = await getDashboardSummaryService();
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getStoreSummary = async (req, res) => {
  try {
    const data = await getStoreSummaryService();
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getUserSummary = async (req, res) => {
  try {
    const data = await getUserSummaryService();
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
const getShipperSummary = async (req, res) => {
  try {
    const data = await getShipperSummaryService();
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};
module.exports = {
  getDashboardSummary,
  getStoreSummary,
  getUserSummary,
  getShipperSummary,
};
