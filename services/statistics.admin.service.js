const moment = require("moment-timezone");
const User = require("../models/users.model");
const Shipper = require("../models/shippers.model");
const Store = require("../models/stores.model");
const Order = require("../models/orders.model");
const OrderItem = require("../models/order_items.model");
const ErrorCode = require("../constants/errorCodes.enum");
const Dish = require("../models/dishes.model");
const Category = require("../models/categories.model");

const getDashboardSummaryService = async () => {
  const now = moment().tz("Asia/Ho_Chi_Minh");
  const startOfYear = now.clone().startOf("year").toDate();
  const endOfYear = now.clone().endOf("year").toDate();

  // 1️⃣ Đếm tổng số users, shippers, stores (song song)
  const [totalUsers, totalShippers, totalStores] = await Promise.all([
    User.countDocuments(),
    Shipper.countDocuments(),
    Store.countDocuments(),
  ]);

  // 2️⃣ Thống kê số order theo tháng trong năm hiện tại
  const ordersByMonth = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfYear, $lte: endOfYear },
        deleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: { month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.month": 1 },
    },
  ]);

  // Đảm bảo có đủ 12 tháng (tháng nào không có thì count = 0)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const found = ordersByMonth.find((m) => m._id.month === i + 1);
    return {
      month: i + 1,
      count: found ? found.count : 0,
    };
  });

  return {
    totalUsers,
    totalShippers,
    totalStores,
    ordersByMonth: monthlyData,
  };
};

const getStoreSummaryService = async () => {
  // tổng số store, dish, category
  const [totalStores, totalDishes, totalCategories] = await Promise.all([
    Store.countDocuments(),
    Dish.countDocuments(),
    Category.countDocuments(),
  ]);

  // trạng thái coi là "completed" để tính vào thống kê
  const completedStatuses = ["done", "delivered", "finished"];

  // Top 5 store theo số lượng đơn (count orders)
  const topStores = await Order.aggregate([
    {
      $match: {
        // status: { $in: completedStatuses },
        deleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$storeId",
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { orderCount: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "stores",
        localField: "_id",
        foreignField: "_id",
        as: "store",
      },
    },
    { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        storeId: "$_id",
        storeName: "$store.name",
        orderCount: 1,
      },
    },
  ]);

  // Top 5 dish theo tổng quantity được đặt (từ order_items)
  const topDishes = await OrderItem.aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    { $unwind: "$order" },
    {
      $match: {
        "order.deleted": { $ne: true },
      },
    },
    {
      $group: {
        _id: "$dishId",
        dishName: { $first: "$dishName" },
        totalSold: { $sum: "$quantity" },
        orderLinesCount: { $sum: 1 },
        totalLineRevenue: { $sum: { $ifNull: ["$lineTotal", 0] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "dishes",
        localField: "_id",
        foreignField: "_id",
        as: "dish",
      },
    },
    { $unwind: { path: "$dish", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "stores",
        localField: "dish.storeId",
        foreignField: "_id",
        as: "store",
      },
    },
    { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        dishId: "$_id",
        dishName: 1,
        totalSold: 1,
        orderLinesCount: 1,
        storeId: "$dish.storeId",
        storeName: "$store.name", // thêm tên quán
        price: "$dish.price",
        image: "$dish.image",
      },
    },
  ]);

  return {
    totals: {
      stores: totalStores,
      dishes: totalDishes,
      categories: totalCategories,
    },
    topStores, // [{ storeId, storeName, orderCount }, ...]
    topDishes, // [{ dishId, dishName, totalSold, orderLinesCount, storeId, ... }, ...]
  };
};
const getUserSummaryService = async () => {
  try {
    const now = new Date();

    // ===== 1️⃣ Orders in most recent 2 weeks (daily stats) =====
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 13); // 14 ngày bao gồm cả hôm nay

    const recentOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // chuẩn hóa dữ liệu đủ 14 ngày
    const dailyStats = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const formatted = date.toISOString().slice(0, 10);
      const found = recentOrders.find((r) => r._id === formatted);
      dailyStats.push({
        date: formatted,
        count: found ? found.count : 0,
      });
    }

    // ===== 2️⃣ Orders this year by month =====
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const ordersByMonth = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: now },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const found = ordersByMonth.find((m) => m._id === i + 1);
      return { month: i + 1, count: found ? found.count : 0 };
    });

    // ===== 3️⃣ Top 5 customers (by order count) =====
    const topCustomers = await Order.aggregate([
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          userName: "$user.name",
          email: "$user.email",
          orderCount: 1,
        },
      },
    ]);

    return {
      recent2Weeks: dailyStats,
      ordersByMonth: monthlyStats,
      topCustomers,
    };
  } catch (err) {
    console.error("Error in getUserStatisticsService:", err);
    throw err;
  }
};

const getShipperSummaryService = async () => {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // ===== 1️⃣ Total shippers =====
    const totalShippers = await Shipper.countDocuments();

    // ===== 2️⃣ Online shippers =====
    const onlineShippers = await Shipper.countDocuments({ online: true });

    // ===== 3️⃣ Shippers registered this year (by month) =====
    const shippersByMonth = await Shipper.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: now },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Chuẩn hóa dữ liệu đủ 12 tháng
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const found = shippersByMonth.find((m) => m._id === i + 1);
      return { month: i + 1, count: found ? found.count : 0 };
    });

    return {
      totalShippers,
      onlineShippers,
      shippersByMonth: monthlyStats,
    };
  } catch (err) {
    console.error("Error in getShipperStatisticsService:", err);
    throw err;
  }
};

module.exports = {
  getDashboardSummaryService,
  getStoreSummaryService,
  getUserSummaryService,
  getShipperSummaryService,
};
