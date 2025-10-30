const ApiResponse = require("../utils/apiResponse");
const {
  getUserOrdersService,
  getOrderDetailService,
  getOrderDetailForStoreService,
  getFinishedOrdersService,
  updateOrderStatusService,
  getOrderStatsService,
  getMonthlyOrderStatsService,
  getAllOrderService,
  updateOrderService,
  reOrderService,
  cancelOrderService,
  takeOrderService,
  startDeliveryService,
  markDeliveredService,
  completeOrderService,
  getOngoingOrderService,
} = require("../services/order.service");
const ErrorCode = require("../constants/errorCodes.enum");

const getUserOrders = async (req, res) => {
  try {
    const data = await getUserOrdersService(req.user?._id);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getOrderDetail = async (req, res) => {
  try {
    const data = await getOrderDetailService(req.params.orderId);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getOrderDetailForStore = async (req, res) => {
  try {
    const data = await getOrderDetailForStoreService(req.params.orderId);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getFinishedOrders = async (req, res) => {
  try {
    const data = await getFinishedOrdersService();
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const data = await updateOrderStatusService(
      req.params.orderId,
      req.body.status
    );
    return ApiResponse.success(
      res,
      data,
      `Order status updated to '${req.body.status}' successfully`
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getOrderStats = async (req, res) => {
  try {
    const data = await getOrderStatsService();
    return ApiResponse.success(res, data, "Order statistics retrieved");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getMonthlyOrderStats = async (req, res) => {
  try {
    const data = await getMonthlyOrderStatsService();
    return ApiResponse.success(res, data, "Monthly order stats retrieved");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getAllOrder = async (req, res) => {
  try {
    const data = await getAllOrderService(req.params.storeId, req.query);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateOrder = async (req, res) => {
  try {
    await updateOrderService(req.params.order_id, req.body);
    return ApiResponse.success(res, null, "Order updated successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const reOrder = async (req, res) => {
  try {
    const data = await reOrderService(req.user?._id, req.params.orderId);
    return ApiResponse.success(res, data, "Reorder successful", 201);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const cancelOrder = async (req, res) => {
  try {
    const data = await cancelOrderService(req.user?._id, req.params.orderId);
    return ApiResponse.success(res, data, "Order cancelled successfully", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const takeOrder = async (req, res) => {
  try {
    const data = await takeOrderService(req.user?._id, req.params.orderId);
    return ApiResponse.success(res, data, "Order taken successfully", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const startDelivery = async (req, res) => {
  try {
    const data = await startDeliveryService(req.params.orderId);
    return ApiResponse.success(
      res,
      data,
      "Order being delivered successfully",
      200
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const markDelivered = async (req, res) => {
  try {
    const data = await markDeliveredService(req.params.orderId);
    return ApiResponse.success(res, data, "Order delivered successfully", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const completeOrder = async (req, res) => {
  try {
    const data = await completeOrderService(req.user?._id, req.params.orderId);
    return ApiResponse.success(res, data, "Order done successfully", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getOngoingOrder = async (req, res) => {
  try {
    const data = await getOngoingOrderService(req.user?._id);
    return ApiResponse.success(res, data, "Order get successfully", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

module.exports = {
  getUserOrders,
  getOrderDetail,
  getOrderDetailForStore,
  getFinishedOrders,
  updateOrderStatus,
  getOrderStats,
  getMonthlyOrderStats,
  getAllOrder,
  updateOrder,
  reOrder,
  cancelOrder,
  takeOrder,
  startDelivery,
  markDelivered,
  completeOrder,
  getOngoingOrder,
};
