const Notification = require("../models/notifications.model");
const Store = require("../models/stores.model");
const ErrorCode = require("../constants/errorCodes.enum");
const { getPaginatedData } = require("../utils/paging");

const getNotificationsService = async () => {
  const notifications = await Notification.find().sort({ createdAt: -1 }).lean();
  return notifications;
};

const updateNotificationService = async (notiId) => {
  if (!notiId) throw ErrorCode.NOTIFICATION_NOT_FOUND;

  const notification = await Notification.findById(notiId);
  if (!notification) throw ErrorCode.NOTIFICATION_NOT_FOUND;

  if (notification.status !== "read") {
    notification.status = "read";
    await notification.save();
  }

  return { success: true };
};

const getStoreNotificationsService = async (storeId, page, limit) => {
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  const store = await Store.findById(storeId);
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const ownerId = store.owner;
  if (!ownerId) throw ErrorCode.USER_NOT_FOUND;

  const result = await getPaginatedData(
    Notification,
    { userId: ownerId },
    [],
    limit,
    page,
    { createdAt: -1 }
  );

  return result;
};

const markAllNotificationsAsReadService = async (userId) => {
  // Update all notifications for this user that are currently 'unread'
  const result = await Notification.updateMany(
    { userId: userId, status: "unread" }, 
    { $set: { status: "read" } }
  );
  
  return result;
};

module.exports = {
  getNotificationsService,
  updateNotificationService,
  getStoreNotificationsService,
  markAllNotificationsAsReadService
};
