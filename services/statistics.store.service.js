const ErrorCode = require("../constants/errorCodes.enum");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const Store = require("../models/stores.model");
const Order = require("../models/orders.model");
const OrderItem = require("../models/order_items.model");
const Voucher = require("../models/vouchers.model");
const OrderVoucher = require("../models/order_vouchers.model");

const getStoreIdFromUser = async (userId) => {
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;
  return store._id;
};

const parseDateRange = (from, to) => {
  if (!from || !to) {
    throw ErrorCode.MISSING_REQUIRED_FIELDS;
  }
  const startDate = moment(from, "YYYY-MM-DD", true);
  const endDate = moment(to, "YYYY-MM-DD", true);
  if (!startDate.isValid() || !endDate.isValid()) {
    throw ErrorCode.INVALID_DATE_INPUT;
  }
  if (endDate.isBefore(startDate)) {
    throw ErrorCode.INVALID_DATE_RANGE;
  }
  return {
    startDate: startDate.startOf("day").utc().toDate(),
    endDate: endDate.endOf("day").utc().toDate(),
  };
};

const getRevenueSummaryService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Tìm store của user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });

  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;
  const now = moment().tz("Asia/Ho_Chi_Minh");

  const startOfToday = now.clone().startOf("day").utc().toDate();
  const startOfWeek = now.clone().startOf("isoWeek").utc().toDate();
  const startOfMonth = now.clone().startOf("month").utc().toDate();

  const matchBase = {
    storeId,
    status: { $in: ["done", "delivered", "delivering", "finished"] },
  };

  const [today, week, month] = await Promise.all([
    Order.aggregate([
      { $match: { ...matchBase, createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: "$finalTotal" } } },
    ]),
    Order.aggregate([
      { $match: { ...matchBase, createdAt: { $gte: startOfWeek } } },
      { $group: { _id: null, total: { $sum: "$finalTotal" } } },
    ]),
    Order.aggregate([
      { $match: { ...matchBase, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$finalTotal" } } },
    ]),
  ]);

  return {
    today: today[0]?.total || 0,
    week: week[0]?.total || 0,
    month: month[0]?.total || 0,
  };
};

const getStartDates = () => {
  const now = moment().tz("Asia/Ho_Chi_Minh");
  return {
    today: now.clone().startOf("day").utc().toDate(),
    week: now.clone().startOf("isoWeek").utc().toDate(),
    month: now.clone().startOf("month").utc().toDate(),
  };
};

const getDailyRevenueService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // 1. Find the store
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });

  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;
  const now = moment().tz("Asia/Ho_Chi_Minh");

  const startOfMonth = now.clone().startOf("month").toDate();
  const endOfToday = now.clone().endOf("day").toDate();

  // 2. Aggregate by day
  const dailyRevenue = await Order.aggregate([
    {
      $match: {
        storeId,
        status: { $in: ["done", "delivered", "delivering", "finished"] },
        createdAt: {
          $gte: startOfMonth,
          $lte: endOfToday,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Asia/Ho_Chi_Minh",
          },
        },
        revenue: { $sum: "$finalTotal" },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",
        revenue: 1,
      },
    },
  ]);

  return dailyRevenue;
};

const getRevenueByItemService = async (userId, limit = 5) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // 1. Find store
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });

  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = new mongoose.Types.ObjectId(store._id);

  // 2. Get orderIds
  const orders = await Order.find({
    storeId,
    status: { $in: ["done", "delivered", "delivering", "finished"] },
  }).select("_id");

  if (!orders.length) return []; // Nếu store chưa có order

  const orderIds = orders.map((o) => o._id);

  // 3. Aggregate revenue from OrderItem
  const result = await OrderItem.aggregate([
    { $match: { orderId: { $in: orderIds } } },
    {
      $group: {
        _id: "$dishName",
        totalRevenue: { $sum: { $multiply: ["$price", "$quantity"] } },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
    { $project: { _id: 0, dishName: "$_id", totalRevenue: 1 } },
  ]);

  return result;
};

const getRevenueByCategoryService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // 1. Get storeId for owner or staff
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });

  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;

  // 2. Find finished orders belonging to the store
  const orders = await Order.find({
    storeId,
    status: { $in: ["done", "delivered", "delivering", "finished"] },
  }).select("_id");

  if (!orders.length) return []; // Không có order nào

  const orderIds = orders.map((o) => o._id);

  // 3. Aggregate revenue grouped by dish.categoryId
  const results = await OrderItem.aggregate([
    { $match: { orderId: { $in: orderIds } } },
    {
      $lookup: {
        from: "dishes",
        localField: "dishId",
        foreignField: "_id",
        as: "dishDetail",
      },
    },
    { $unwind: "$dishDetail" },
    {
      $group: {
        _id: "$dishDetail.category",
        totalRevenue: {
          $sum: { $multiply: ["$price", "$quantity"] },
        },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        categoryId: "$category._id",
        name: "$category.name",
        totalRevenue: 1,
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);

  return results;
};

const getOrderSummaryStatsService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const matchStatus = {
    status: { $in: ["done", "delivered", "delivering", "finished"] },
    storeId,
  };

  const [todayCount, weekCount, monthCount] = await Promise.all([
    Order.countDocuments({ ...matchStatus, createdAt: { $gte: startOfToday } }),
    Order.countDocuments({ ...matchStatus, createdAt: { $gte: startOfWeek } }),
    Order.countDocuments({ ...matchStatus, createdAt: { $gte: startOfMonth } }),
  ]);

  return {
    today: todayCount,
    thisWeek: weekCount,
    thisMonth: monthCount,
  };
};

const getOrderStatusRateService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;

  const completedStatuses = ["done", "delivered", "delivering", "finished"];
  const cancelledStatuses = ["cancelled"];

  const [completedCount, cancelledCount] = await Promise.all([
    Order.countDocuments({ storeId, status: { $in: completedStatuses } }),
    Order.countDocuments({ storeId, status: { $in: cancelledStatuses } }),
  ]);

  return {
    completed: completedCount,
    cancelled: cancelledCount,
  };
};

const getOrdersOverTimeService = async (userId, from, to) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;
  const now = new Date();

  let startDate, endDate;

  if (from && to) {
    startDate = new Date(from);
    endDate = new Date(to);
  } else {
    // Default: last 7 days
    endDate = new Date(now);
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);
  }

  // Ensure endDate includes full day
  endDate.setHours(23, 59, 59, 999);

  const results = await Order.aggregate([
    {
      $match: {
        storeId,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",
        orders: 1,
      },
    },
  ]);

  return results;
};

const getOrderStatusDistributionService = async (userId, from, to) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;
  const now = new Date();

  let startDate, endDate;
  if (from && to) {
    startDate = new Date(from);
    endDate = new Date(to);
  } else {
    endDate = new Date(now);
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6); // default last 7 days
  }

  // Ensure endDate includes full day
  endDate.setHours(23, 59, 59, 999);

  // Aggregate orders by status
  const results = await Order.aggregate([
    {
      $match: {
        storeId,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Map kết quả sang object với tất cả status hợp lệ
  const validStatuses = [
    "pending",
    "confirmed",
    "finished",
    "taken",
    "delivering",
    "delivered",
    "done",
    "cancelled",
  ];

  const statusMap = {};
  for (const status of validStatuses) {
    statusMap[status] = 0;
  }

  for (const item of results) {
    statusMap[item._id] = item.count;
  }

  return statusMap;
};

const getTopSellingItemsService = async (userId, limit = 5) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;

  const results = await OrderItem.aggregate([
    {
      $lookup: {
        from: "dishes",
        localField: "dishId",
        foreignField: "_id",
        as: "dish",
      },
    },
    { $unwind: "$dish" },
    {
      $match: {
        "dish.storeId": storeId,
      },
    },
    {
      $group: {
        _id: "$dishId",
        dishName: { $first: "$dishName" },
        sold: { $sum: "$quantity" },
      },
    },
    { $sort: { sold: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        dishName: 1,
        sold: 1,
      },
    },
  ]);

  return results;
};

const getRevenueContributionByItemService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;

  // Aggregate doanh thu theo món
  const rawData = await OrderItem.aggregate([
    {
      $lookup: {
        from: "dishes",
        localField: "dishId",
        foreignField: "_id",
        as: "dish",
      },
    },
    { $unwind: "$dish" },
    {
      $match: { "dish.storeId": storeId },
    },
    {
      $group: {
        _id: "$dishName",
        revenue: { $sum: { $multiply: ["$price", "$quantity"] } },
      },
    },
  ]);

  const totalRevenue = rawData.reduce((sum, item) => sum + item.revenue, 0);
  if (totalRevenue === 0) return [];

  const contributionData = [];
  let othersRevenue = 0;

  rawData.forEach((item) => {
    const percent = (item.revenue / totalRevenue) * 100;
    if (percent < 5) {
      othersRevenue += item.revenue;
    } else {
      contributionData.push({
        dishName: item._id,
        contribution: Math.round(percent),
      });
    }
  });

  if (othersRevenue > 0) {
    contributionData.push({
      dishName: "Các món khác",
      contribution: Math.round((othersRevenue / totalRevenue) * 100),
    });
  }

  return contributionData;
};

const getOrdersByTimeSlotService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;

  // Định nghĩa các khung giờ
  const timeSlots = [
    { label: "06:00-10:00", start: 6, end: 10 },
    { label: "10:00-14:00", start: 10, end: 14 },
    { label: "14:00-18:00", start: 14, end: 18 },
    { label: "18:00-22:00", start: 18, end: 22 },
  ];

  // Aggregate số đơn theo giờ
  const results = await Order.aggregate([
    { $match: { storeId } },
    {
      $project: {
        hour: { $hour: { date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } },
      },
    },
    {
      $group: { _id: "$hour", orders: { $sum: 1 } },
    },
  ]);

  // Map kết quả sang khung giờ
  const slotCounts = timeSlots.map((slot) => ({
    timeSlot: slot.label,
    orders: 0,
  }));

  results.forEach((item) => {
    const hour = item._id;
    for (let i = 0; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      if (hour >= slot.start && hour < slot.end) {
        slotCounts[i].orders += item.orders;
        break;
      }
    }
  });

  return slotCounts;
};

const getNewCustomersService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;

  // Lấy first order của từng khách hàng tại store
  const firstOrders = await Order.aggregate([
    { $match: { storeId } },
    { $sort: { createdAt: 1 } }, // oldest first
    {
      $group: {
        _id: "$customerId",
        firstOrder: { $first: "$createdAt" },
      },
    },
  ]);

  const today = moment().tz("Asia/Ho_Chi_Minh").startOf("day");
  const startOfWeek = moment().tz("Asia/Ho_Chi_Minh").startOf("isoWeek");
  const startOfMonth = moment().tz("Asia/Ho_Chi_Minh").startOf("month");

  let countToday = 0;
  let countWeek = 0;
  let countMonth = 0;

  firstOrders.forEach((order) => {
    const created = moment(order.firstOrder).tz("Asia/Ho_Chi_Minh");
    if (created.isSameOrAfter(today)) countToday++;
    if (created.isSameOrAfter(startOfWeek)) countWeek++;
    if (created.isSameOrAfter(startOfMonth)) countMonth++;
  });

  return { today: countToday, thisWeek: countWeek, thisMonth: countMonth };
};

const getReturningCustomerRateService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;

  // Nhóm đơn theo khách hàng
  const customerOrders = await Order.aggregate([
    { $match: { storeId } },
    {
      $group: {
        _id: "$customerId",
        orderCount: { $sum: 1 },
      },
    },
  ]);

  const totalCustomers = customerOrders.length;
  const returningCustomers = customerOrders.filter(
    (c) => c.orderCount > 1
  ).length;

  const returningRate =
    totalCustomers > 0
      ? parseFloat(((returningCustomers / totalCustomers) * 100).toFixed(1))
      : 0;

  return { returningRate };
};
const getAverageSpendingPerOrderService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // Lấy storeId từ user
  const store = await Store.findOne({
    $or: [{ owner: userId }, { staff: userId }],
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  const storeId = store._id;

  const result = await Order.aggregate([
    { $match: { storeId } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$finalTotal" },
        totalOrders: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        averageSpending: {
          $cond: [
            { $eq: ["$totalOrders", 0] },
            0,
            { $round: [{ $divide: ["$totalRevenue", "$totalOrders"] }, 0] },
          ],
        },
      },
    },
  ]);

  return result[0] || { averageSpending: 0 };
};

const getVoucherUsageSummaryService = async (userId, from, to) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  // 1. Validate and parse date range
  let startDate, endDate;
  if (from && to) {
    const start = moment(from, "YYYY-MM-DD", true);
    const end = moment(to, "YYYY-MM-DD", true);
    if (!start.isValid() || !end.isValid()) {
      throw { status: 400, message: "Invalid date format. Use YYYY-MM-DD" };
    }
    if (end.isBefore(start)) {
      throw { status: 400, message: "'to' date must be after 'from' date" };
    }
    startDate = start.startOf("day").utc().toDate();
    endDate = end.endOf("day").utc().toDate();
  } else {
    ({ startDate, endDate } = parseDateRange()); // default last 30 days
  }

  // 2. Get store ID
  const storeId = await getStoreIdFromUser(userId);
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  // 3. Get all voucher IDs for the store
  const storeVouchers = await Voucher.find({ storeId }).select("_id createdAt");
  const voucherIds = storeVouchers.map((voucher) => voucher._id);

  if (!voucherIds.length) {
    return {
      requestedTimeFrameUsed: 0,
      totalIssued: 0,
      usageRate: 0,
    };
  }

  // 4. Calculate total issued = sum of usageLimit for all vouchers active in timeframe
  const totalIssuedAgg = await Voucher.aggregate([
    {
      $match: {
        storeId,
        createdAt: { $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalIssued: { $sum: "$usageLimit" },
      },
    },
  ]);
  const totalIssued = totalIssuedAgg[0]?.totalIssued || 0;

  // 5. Aggregate voucher usage in timeframe
  const usageAggregation = await OrderVoucher.aggregate([
    {
      $match: {
        voucherId: { $in: voucherIds },
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $count: "requestedTimeFrameUsed",
    },
  ]);
  const requestedTimeFrameUsed =
    usageAggregation[0]?.requestedTimeFrameUsed || 0;

  // 6. Calculate usage rate
  const usageRate =
    totalIssued > 0 ? (requestedTimeFrameUsed / totalIssued) * 100 : 0;

  return {
    requestedTimeFrameUsed,
    totalIssued,
    usageRate,
  };
};

const getTopUsedVouchersService = async (userId, limit = 5) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  const parsedLimit = parseInt(limit);
  if (isNaN(parsedLimit) || parsedLimit <= 0) {
    throw { status: 400, message: "Limit must be a positive number" };
  }

  // 1. Get store ID
  const storeId = await getStoreIdFromUser(userId);
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  // 2. Aggregate top used vouchers
  const topVouchers = await OrderVoucher.aggregate([
    {
      $lookup: {
        from: Voucher.collection.name,
        localField: "voucherId",
        foreignField: "_id",
        as: "voucherDetails",
      },
    },
    { $unwind: "$voucherDetails" },
    { $match: { "voucherDetails.storeId": storeId } },
    {
      $group: {
        _id: "$voucherId",
        code: { $first: "$voucherDetails.code" },
        discountValue: { $first: "$voucherDetails.discountValue" },
        usedCount: { $sum: 1 },
      },
    },
    { $sort: { usedCount: -1 } },
    { $limit: parsedLimit },
    {
      $project: {
        _id: 1,
        code: 1,
        usedCount: 1,
        discountValue: 1,
      },
    },
  ]);

  return topVouchers;
};

const getVoucherRevenueImpactService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  const storeId = await getStoreIdFromUser(userId);
  console.log("StoreID: ", storeId);
  if (!storeId) throw ErrorCode.STORE_NOT_FOUND;

  const storeVouchers = await Voucher.find({ storeId }).select("_id");
  const voucherIds = storeVouchers.map((v) => v._id);
  console.log("voucherIds", voucherIds);

  const ov = await OrderVoucher.find({ voucherId: { $in: voucherIds } });
  console.log("orderVouchers:", ov);

  const orders = await Order.find({ _id: { $in: ov.map((v) => v.orderId) } });
  console.log("orders:", orders);
  if (!voucherIds.length) {
    return {
      totalDiscountAmount: 0,
      revenueBeforeDiscount: 0,
      revenueAfterDiscount: 0,
      discountRatio: 0,
    };
  }

  const revenueImpact = await OrderVoucher.aggregate([
    { $match: { voucherId: { $in: voucherIds } } },
    {
      $lookup: {
        from: "orders",
        let: { orderId: "$orderId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$orderId"] } } },
          {
            $match: {
              storeId: storeId,
              deleted: false,
              status: { $in: ["finished", "done", "delivered"] },
            },
          },
        ],
        as: "orderDetails",
      },
    },
    { $unwind: "$orderDetails" },
    {
      $group: {
        _id: null,
        totalDiscountAmount: { $sum: "$discountAmount" },
        revenueBeforeDiscount: {
          $sum: {
            $add: ["$orderDetails.subtotalPrice", "$orderDetails.shippingFee"],
          },
        },
        revenueAfterDiscount: { $sum: "$orderDetails.finalTotal" },
      },
    },
    {
      $project: {
        _id: 0,
        totalDiscountAmount: 1,
        revenueBeforeDiscount: 1,
        revenueAfterDiscount: 1,
        discountRatio: {
          $cond: [
            { $eq: ["$revenueBeforeDiscount", 0] },
            0,
            {
              $multiply: [
                { $divide: ["$totalDiscountAmount", "$revenueBeforeDiscount"] },
                100,
              ],
            },
          ],
        },
      },
    },
  ]);

  return (
    revenueImpact[0] || {
      totalDiscountAmount: 0,
      revenueBeforeDiscount: 0,
      revenueAfterDiscount: 0,
      discountRatio: 0,
    }
  );
};

module.exports = {
  getStoreIdFromUser,
  parseDateRange,
  getRevenueSummaryService,
  getStartDates,
  getDailyRevenueService,
  getRevenueByItemService,
  getRevenueByCategoryService,
  getOrderSummaryStatsService,
  getOrderStatusRateService,
  getOrdersOverTimeService,
  getOrderStatusDistributionService,
  getTopSellingItemsService,
  getRevenueContributionByItemService,
  getOrdersByTimeSlotService,
  getNewCustomersService,
  getReturningCustomerRateService,
  getAverageSpendingPerOrderService,
  getVoucherUsageSummaryService,
  getTopUsedVouchersService,
  getVoucherRevenueImpactService,
};
