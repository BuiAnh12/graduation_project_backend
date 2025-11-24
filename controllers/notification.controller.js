const ApiResponse = require("../utils/apiResponse");
const {
  getNotificationsService,
  updateNotificationService,
  getStoreNotificationsService,
  markAllNotificationsAsReadService
} = require("../services/notification.service");

const getNotifications = async (req, res) => {
  try {
    const data = await getNotificationsService();
    return ApiResponse.success(res, data, "Notifications fetched successfully", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateNotification = async (req, res) => {
  try {
    const data = await updateNotificationService(req.params.id);
    return ApiResponse.success(res, data, "Notification updated successfully", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getStoreNotifications = async (req, res) => {
  try {
    const data = await getStoreNotificationsService(req.params.storeId, req.query.page, req.query.limit);
    return ApiResponse.success(res, data, "Store notifications fetched successfully", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  const userId = req.user._id; // Taken from authMiddleware
  try {
    const data = await markAllNotificationsAsReadService(userId);
    return ApiResponse.success(res, data, "All notifications marked as read", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

module.exports = {
  getNotifications,
  updateNotification,
  getStoreNotifications,
  markAllNotificationsAsRead
};
