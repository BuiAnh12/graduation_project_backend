const mongoose = require("mongoose");
const Order = require("../models/orders.model");
const OrderItem = require("../models/order_items.model");
const OrderItemTopping = require("../models/order_item_toppings.model");
const OrderShipInfo = require("../models/order_ship_infos.model");
const OrderVoucher = require("../models/order_vouchers.model");
const Cart = require("../models/carts.model");
const CartItem = require("../models/cart_items.model");
const CartItemTopping = require("../models/cart_item_toppings.model");
const CartParticipant = require("../models/cart_participants.model");
const Invoice = require("../models/invoices.model");
const Payment = require("../models/payments.model");
const { VNPay, ignoreLogger, dateFormat } = require("vnpay");
const ErrorCode = require("../constants/errorCodes.enum");
const { getPaginatedData } = require("../utils/paging");
const { getNextSequence } = require("../utils/counterHelper");
const Shipper = require("../models/shippers.model");
const Staff = require("../models/staffs.model");
const Store = require("../models/stores.model");
const OrderHistory = require("../models/order_histories.model");
const { findNearestShipper } = require("../utils/shipper");
// Sockets
const { getIo, getUserSockets } = require("../utils/socketManager");
const userSockets = getUserSockets();

function calcLineSubtotal(item) {
  const base = Number(item.price || 0);
  const qty = Number(item.quantity || 0);
  const tops = Array.isArray(item.toppings) ? item.toppings : [];
  const topsSum = tops.reduce((s, t) => s + Number(t.price || 0), 0);
  return qty * (base + topsSum);
}

const attachItemsAndToppings = async (orders) => {
  if (!orders || !orders.length) return {};

  const orderIds = orders.map((o) => o._id);

  // 1. Lấy tất cả OrderItem cho orders
  const items = await OrderItem.find({ orderId: { $in: orderIds } })
    .populate({
      path: "dishes", // virtual 'dishes'
      populate: { path: "image", select: "url" }, // nested image
    })
    .lean();

  // 2. Lấy toppings cho các items
  const itemIds = items.map((it) => it._id);
  const toppings = await OrderItemTopping.find({
    orderItemId: { $in: itemIds },
  }).lean();

  // 3. Map toppings theo orderItemId
  const toppingByItem = toppings.reduce((acc, t) => {
    const k = String(t.orderItemId);
    acc[k] = acc[k] || [];
    acc[k].push(t);
    return acc;
  }, {});

  // 4. Gắn toppings và dish vào items
  const itemsByOrder = items.reduce((acc, it) => {
    const k = String(it.orderId);
    const withToppings = {
      ...it,
      dishId: it.dishes || null, // map virtual dishes sang dishId
      toppings: toppingByItem[String(it._id)] || [],
    };
    acc[k] = acc[k] || [];
    acc[k].push(withToppings);
    return acc;
  }, {});

  return itemsByOrder;
};

// ---------- getOrderDetailService ----------

const getUserOrdersService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  const userParticipantDocs = await CartParticipant.find({ userId: userId })
    .select("_id")
    .lean();
  const userParticipantIds = userParticipantDocs.map((p) => p._id);
  // Fetch base orders
  const orders = await Order.find({
    $or: [
      { userId: userId }, // User is the creator
      { participants: { $in: userParticipantIds } }, // User is a participant
    ],
  })
    .populate({
      path: "stores",
      select: "name avatarImage status",
      populate: { path: "avatarImage", select: "url" },
    })
    .populate({ path: "users", select: "name avatarImage" })
    .populate("participants")
    .sort({ updatedAt: -1 })
    .lean();

  // Only keep approved store orders
  const filtered = orders.filter((o) => o.stores?.status === "approved");
  if (!filtered.length) throw ErrorCode.ORDER_NOT_FOUND;

  const orderIds = filtered.map((o) => o._id);

  // Fetch ship infos
  const shipInfos = await OrderShipInfo.find({
    orderId: { $in: orderIds },
  }).lean();
  const shipMap = Object.fromEntries(
    shipInfos.map((i) => [i.orderId.toString(), i])
  );

  // Fetch items for these orders
  const items = await OrderItem.find({ orderId: { $in: orderIds } })
    .populate({
      path: "dishId",
      select: "image",
      populate: {
        path: "image",
        select: "url",
      },
    })
    .lean();

  // Fetch toppings for these items
  const toppings = await OrderItemTopping.find({
    orderItemId: { $in: items.map((it) => it._id) },
  }).lean();

  const toppingMap = items.reduce((acc, it) => {
    acc[it._id.toString()] = toppings.filter(
      (t) => t.orderItemId.toString() === it._id.toString()
    );
    return acc;
  }, {});

  // Fetch vouchers for these orders
  const vouchers = await OrderVoucher.find({
    orderId: { $in: orderIds },
  }).lean();
  const voucherMap = Object.fromEntries(
    vouchers.map((v) => [v.orderId.toString(), v])
  );

  // Assemble final structure
  return filtered.map((o) => {
    const orderItems = items
      .filter((it) => it.orderId.toString() === o._id.toString())
      .map((it) => ({
        ...it,
        toppings: toppingMap[it._id.toString()] || [],
      }));

    return {
      ...o,
      items: orderItems,
      shipInfo: shipMap[o._id.toString()] || null,
      voucher: voucherMap[o._id.toString()] || null,
    };
  });
};

const getOrderDetailService = async (orderId) => {
  if (!orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  // populate `stores` virtual (your schema defines 'stores' and 'users')
  const order = await Order.findById(orderId)
    .populate({
      path: "stores",
      select: "name avatarImage",
      populate: {
        path: "avatarImage",
        select: "url",
      },
    })
    .populate({ path: "users", select: "name avatar" })
    .populate({
      path: "participants",
      populate: "userId",
    })
    .lean();

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  // ship info
  const shipInfo = await OrderShipInfo.findOne({ orderId }).lean();

  // vouchers (with voucher snapshot)
  const vouchers = await OrderVoucher.find({ orderId })
    .populate({
      path: "voucherId",
      select: "code description discountType discountValue maxDiscount",
    })
    .lean();

  // items + toppings
  const items = await OrderItem.find({ orderId }).lean();
  const itemIds = items.map((it) => it._id);
  const toppings = await OrderItemTopping.find({
    orderItemId: { $in: itemIds },
  }).lean();
  const toppingByItem = toppings.reduce((acc, t) => {
    const k = String(t.orderItemId);
    acc[k] = acc[k] || [];
    acc[k].push(t);
    return acc;
  }, {});
  const itemsWithToppings = items.map((it) => ({
    ...it,
    toppings: toppingByItem[String(it._id)] || [],
  }));

  return {
    ...order,
    items: itemsWithToppings,
    shipInfo: shipInfo || null,
    vouchers: vouchers || [],
  };
};

const getOrderDetailShipperService = async (orderId) => {
  if (!orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  // 1. Lấy order + populate stores, userId, shipInfo
  const order = await Order.findById(orderId)
    .populate({
      path: "stores",
      select: "name avatarImage address_full location",
      populate: { path: "avatarImage", select: "url" },
    })
    .populate({
      path: "userId",
      select: "name avatar avatarImage",
      populate: { path: "avatarImage", select: "url" },
    })
    .populate({
      path: "shipInfo",
      select:
        "address detailAddress contactName contactPhonenumber note shipLocation",
    })
    .lean();

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  // 2. Voucher
  const vouchers = await OrderVoucher.find({ orderId })
    .populate({
      path: "voucherId",
      select: "code description discountType discountValue maxDiscount",
    })
    .lean();

  // 3. Items + toppings + dish.image
  const itemsByOrder = await attachItemsAndToppings([order]);

  return {
    ...order,
    items: itemsByOrder[String(order._id)] || [],
    vouchers: vouchers || [],
  };
};

// ---------- getOrderDetailForStoreService ----------
const getOrderDetailForStoreService = async (orderId) => {
  if (!orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  const order = await Order.findById(orderId)
    .populate({ path: "stores", select: "name avatar" })
    .populate({ path: "users", select: "name avatar email" })
    .lean();

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  const shipInfo = await OrderShipInfo.findOne({ orderId }).lean();

  // items + toppings
  const items = await OrderItem.find({ orderId }).lean();
  const itemIds = items.map((it) => it._id);
  const toppings = await OrderItemTopping.find({
    orderItemId: { $in: itemIds },
  }).lean();
  const toppingByItem = toppings.reduce((acc, t) => {
    const k = String(t.orderItemId);
    acc[k] = acc[k] || [];
    acc[k].push(t);
    return acc;
  }, {});
  const itemsWithToppings = items.map((it) => ({
    ...it,
    toppings: toppingByItem[String(it._id)] || [],
  }));

  return {
    ...order,
    items: itemsWithToppings,
    shipInfo: shipInfo || null,
  };
};

// ---------- getFinishedOrdersService ----------
const getFinishedOrdersService = async () => {
  // 1. Lấy danh sách đơn hàng đã hoàn thành
  const finished = await Order.find({ status: "finished" })
    .populate({
      path: "stores",
      select: "name avatarImage address_full location",
      populate: { path: "avatarImage", select: "url" },
    })
    .populate({
      path: "userId",
      select: "name avatar avatarImage",
      populate: { path: "avatarImage", select: "url" },
    })
    .populate({
      path: "shipInfo",
      select:
        "address detailAddress contactName contactPhonenumber note shipLocation",
    })
    .sort({ updatedAt: -1 })
    .lean();

  if (!finished.length) return [];

  // 2. Lấy items + toppings + dish.image
  const itemsByOrder = await attachItemsAndToppings(finished);
  const result = finished.map((o) => ({
    ...o,
    items: itemsByOrder[String(o._id)] || [],
  }));
  return result;
};

// ---------- updateOrderStatusService ----------
const updateOrderStatusService = async (orderId, status) => {
  if (!orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  // fetch order (no items required here)
  const order = await Order.findById(orderId)
    .populate({ path: "stores", select: "_id name" })
    .populate({ path: "users", select: "_id name" });

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  // allowed transitions
  const transitions = {
    pending: ["preparing"],
    preparing: ["finished"],
    finished: ["delivering"],
    delivering: ["done"],
    store_delivering: ["done"],
  };

  if (status === order.status) throw ErrorCode.ORDER_STATUS_ALREADY_SET;
  if (
    !transitions[order.status] ||
    !transitions[order.status].includes(status)
  ) {
    throw ErrorCode.INVALID_STATUS_TRANSITION;
  }

  order.status = status;
  await order.save();

  // if status becomes done -> create invoice
  if (status === "done") {
    // use the storeId from order.storeId
    const storeId = order.storeId || (order.stores && order.stores._id) || null;
    // getNextSequence is referenced in your original code; keep using it
    const seq = await getNextSequence(storeId, "invoice");
    const invoiceNumber = `INV-${Date.now()}-${String(seq).padStart(4, "0")}`;

    const invoice = await Invoice.create({
      invoiceNumber,
      orderId: order._id,
      issuedAt: new Date(),
      subtotal: order.subtotalPrice,
      shippingFee: order.shippingFee,
      total: order.finalTotal,
      currency: order.currency || "VND",
      status: "issued",
      orderSnapshot: order.toObject ? order.toObject() : order,
    });

    return { order, invoice };
  }

  return { order };
};

const getStoreByUserId = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;

  const store = await Store.findOne({
    $or: [
      { staff: userId }, // user là nhân viên
      { owner: userId }, // hoặc user là chủ cửa hàng
    ],
  });

  return store;
};

const finishOrderService = async (userId, orderId) => {
  console.log(userId);
  if (!orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  // 1️⃣ Lấy order
  const order = await Order.findById(orderId)
    .populate({ path: "stores", select: "_id name" })
    .populate({ path: "users", select: "_id name" });

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  if (order.status === "finished") throw ErrorCode.ORDER_STATUS_ALREADY_SET;
  if (order.status !== "preparing") throw ErrorCode.INVALID_STATUS_TRANSITION;

  // 2️⃣ Cập nhật trạng thái
  order.status = "finished";
  await order.save();

  // 3️⃣ Lấy store và tìm shipper gần nhất
  const store = await getStoreByUserId(userId);
  console.log("STORE", store);
  const availableShipper = await findNearestShipper(
    store.location.lat,
    store.location.lon,
    order.excludedShippers
  );

  // console.log("Available shipper: ", availableShipper.name);

  // 4️⃣ Gửi socket event
  const io = getIo();
  console.log("👀 userSockets hiện tại:", Object.keys(userSockets));
  if (availableShipper && userSockets[availableShipper._id]) {
    userSockets[availableShipper._id].forEach((socketId) => {
      io.to(socketId).emit("newOrderAvailable", {
        orderId: order._id,
        store: store.name,
        status: order.status,
        location: { lat: store.lat, lon: store.lon },
        message: "Có đơn hàng mới gần bạn!",
      });
    });
    if (availableShipper) {
      if (!order.alreadysendNoti.includes(availableShipper._id)) {
        order.alreadysendNoti.push(availableShipper._id);
        await order.save();
      }
    }
    console.log(
      `📦 Emit newOrderAvailable to shipper ${availableShipper.userId}`
    );
  } else {
    console.log("⚠️ Không tìm thấy shipper khả dụng");
  }

  return { order };
};

const rejectOrderService = async (shipperId, orderId) => {
  if (!orderId || !shipperId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const order = await Order.findById(orderId);
  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  // Nếu chưa có field này thì khởi tạo mảng
  if (!Array.isArray(order.excludedShippers)) order.excludedShippers = [];

  // Nếu chưa có thì thêm shipper này vào danh sách loại trừ
  if (!order.excludedShippers.includes(shipperId)) {
    order.excludedShippers.push(shipperId);
  }

  // Option: cập nhật trạng thái tạm

  await order.save();

  // 🔍 Tìm shipper mới
  const store = await Store.findById(order.storeId);
  const newShipper = await findNearestShipper(
    store.location.lat,
    store.location.lon,
    order.excludedShippers
  );

  const io = getIo();

  if (newShipper && userSockets[newShipper._id]) {
    userSockets[newShipper._id].forEach((socketId) => {
      io.to(socketId).emit("newOrderAvailable", {
        orderId: order._id,
        store: store.name,
        status: order.status,
        location: { lat: store.lat, lon: store.lon },
        message: "Có đơn hàng kế gần bạn!",
      });
    });
    console.log(`📦 Gửi đơn ${order._id} cho shipper mới ${newShipper._id}`);
  } else {
    console.log("⚠️ Không còn shipper khả dụng");
    // Có thể chuyển order sang trạng thái "no_shipper_available"
  }
  return order;
};

const resendNotificationToShipperService = async (userId, orderId) => {
  if (!orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  // 1️⃣ Lấy order
  const order = await Order.findById(orderId)
    .populate({ path: "stores", select: "_id name" })
    .populate({ path: "users", select: "_id name" });

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  // 3️⃣ Lấy store và tìm shipper gần nhất
  const store = await getStoreByUserId(userId);
  const excludeList = [
    ...(order.excludedShippers || []),
    ...(order.alreadysendNoti || []),
  ];
  const availableShipper = await findNearestShipper(
    store.location.lat,
    store.location.lon,
    excludeList
  );

  // 4️⃣ Gửi socket event
  const io = getIo();
  console.log("👀 userSockets hiện tại:", Object.keys(userSockets));
  if (availableShipper && userSockets[availableShipper._id]) {
    userSockets[availableShipper._id].forEach((socketId) => {
      io.to(socketId).emit("newOrderAvailable", {
        orderId: order._id,
        store: store.name,
        status: order.status,
        location: { lat: store.lat, lon: store.lon },
        message: "Có đơn hàng mới gần bạn!",
      });
    });
    console.log(
      `📦 Emit newOrderAvailable to shipper ${availableShipper.userId}`
    );
    if (availableShipper) {
      if (!order.alreadysendNoti.includes(availableShipper._id)) {
        order.alreadysendNoti.push(availableShipper._id);
        await order.save();
      }
    }
  } else {
    console.log("⚠️ Không tìm thấy shipper khả dụng");
  }

  return { order };
};

const deliveryByStoreService = async (orderId) => {
  if (!orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  // 1️⃣ Lấy order
  const order = await Order.findById(orderId)
    .populate({ path: "stores", select: "_id name" })
    .populate({ path: "users", select: "_id name" });

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  if (order.status === "taken" || order.status === "store_delivering") {
    throw ErrorCode.ORDER_STATUS_ALREADY_SET;
  }
  if (order.status !== "finished") throw ErrorCode.INVALID_STATUS_TRANSITION;

  // 2️⃣ Cập nhật trạng thái
  order.status = "store_delivering";
  await order.save();
  return { order };
};

// ---------- getOrderStatsService ----------
const getOrderStatsService = async () => {
  const totalOrders = await Order.countDocuments();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);

  const ordersThisMonth = await Order.countDocuments({
    createdAt: { $gte: startOfMonth, $lt: endOfMonth },
  });
  return { totalOrders, ordersThisMonth };
};

// ---------- getMonthlyOrderStatsService ----------
const getMonthlyOrderStatsService = async () => {
  const stats = await Order.aggregate([
    { $match: {} },
    { $group: { _id: { $month: "$createdAt" }, total: { $sum: 1 } } },
  ]);
  return Array.from({ length: 12 }, (_, i) => {
    const stat = stats.find((s) => s._id === i + 1);
    return { name: `Tháng ${i + 1}`, total: stat ? stat.total : 0 };
  });
};

// ---------- getAllOrderService ----------
const getAllOrderService = async (storeId, { status, limit, page, name }) => {
  const filter = { storeId };
  if (status)
    filter.status = { $in: Array.isArray(status) ? status : status.split(",") };
  if (name?.trim()) {
    const regex = new RegExp(name, "i");
    filter.$or = [{ customerName: regex }, { customerPhonenumber: regex }];
  }

  // getPaginatedData should give paginated orders with stores/users populated.
  const result = await getPaginatedData(
    Order,
    filter,
    [
      { path: "stores", select: "name avatar" },
      { path: "users", select: "name email avatar" },
    ],
    limit,
    page
  );

  // Attach items & toppings for the paginated page
  const pageOrders = result.data || [];
  const itemsByOrder = await attachItemsAndToppings(pageOrders);

  result.data = pageOrders.map((o) => ({
    ...o,
    items: itemsByOrder[String(o._id)] || [],
  }));

  // Extra name filtering across joined user fields (if needed)
  if (name?.trim()) {
    const regex = new RegExp(name, "i");
    result.data = result.data.filter(
      (o) =>
        o.users?.name?.match(regex) ||
        o.customerName?.match(regex) ||
        o.customerPhonenumber?.match(regex)
    );
  }

  return result;
};

// ---------- updateOrderService ----------
const updateOrderService = async (orderId, payload) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw ErrorCode.ORDER_NOT_FOUND;

      const incoming = Array.isArray(payload.items) ? payload.items : [];
      if (!incoming.length) throw ErrorCode.ORDER_EMPTY_ITEMS;

      const existing = await OrderItem.find({ orderId }).session(session);
      const existingMap = new Map(existing.map((i) => [String(i._id), i]));

      const kept = [];
      for (const it of incoming) {
        if (!it.dishId || !it.dishName || !it.quantity || !it.price)
          throw ErrorCode.ORDER_INVALID_ITEM;

        const doc = {
          orderId,
          dishId: it.dishId,
          dishName: it.dishName,
          quantity: it.quantity,
          price: it.price,
          note: it.note || "",
        };
        let itemDoc;
        if (it._id && existingMap.has(String(it._id))) {
          itemDoc = await OrderItem.findByIdAndUpdate(
            it._id,
            { $set: doc },
            { new: true, session }
          );
        } else {
          itemDoc = await OrderItem.create([doc], { session }).then(
            (arr) => arr[0]
          );
        }
        kept.push(String(itemDoc._id));

        // replace toppings for this item
        await OrderItemTopping.deleteMany({ orderItemId: itemDoc._id }).session(
          session
        );
        if (Array.isArray(it.toppings) && it.toppings.length) {
          const tops = it.toppings.map((t) => ({
            orderItemId: itemDoc._id,
            toppingId: t._id,
            toppingName: t.toppingName || t.name,
            price: t.price,
          }));
          await OrderItemTopping.insertMany(tops, { session });
        }
      }

      // remove deleted items & their toppings
      const toDelete = existing
        .filter((e) => !kept.includes(String(e._id)))
        .map((e) => e._id);
      if (toDelete.length) {
        await OrderItemTopping.deleteMany({
          orderItemId: { $in: toDelete },
        }).session(session);
        await OrderItem.deleteMany({ _id: { $in: toDelete } }).session(session);
      }

      // recalc totals
      let subtotal = 0;
      for (const it of incoming) {
        // keep your calcLineSubtotal helper (assumes price * quantity + toppings)
        subtotal += calcLineSubtotal(it);
      }
      const shipping = Number(payload.shippingFee ?? order.shippingFee ?? 0);
      const discount = Number(
        payload.totalDiscount ?? order.totalDiscount ?? 0
      );
      const finalTotal = subtotal + shipping - discount;

      const patch = {
        status: payload.status ?? order.status,
        paymentMethod: payload.paymentMethod ?? order.paymentMethod,
        paymentStatus: payload.paymentStatus ?? order.paymentStatus,
        subtotalPrice: subtotal,
        totalDiscount: discount,
        shippingFee: shipping,
        finalTotal,
      };
      await Order.updateOne({ _id: orderId }, { $set: patch }).session(session);
    });
  } finally {
    session.endSession();
  }
};

// ---------- reOrderService ----------
const reOrderService = async (userId, orderId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  const order = await Order.findById(orderId)
    .populate({ path: "stores", select: "_id name status" })
    .lean();
  if (!order || !order.stores) throw ErrorCode.ORDER_NOT_FOUND;
  if (order.stores.status === "BLOCKED") throw ErrorCode.STORE_BLOCKED;

  // fetch items + toppings, including dish stockStatus if needed
  const items = await OrderItem.find({ orderId }).lean();
  const itemIds = items.map((it) => it._id);
  const toppings = await OrderItemTopping.find({
    orderItemId: { $in: itemIds },
  }).lean();
  const toppingByItem = toppings.reduce((acc, t) => {
    const k = String(t.orderItemId);
    acc[k] = acc[k] || [];
    acc[k].push(t);
    return acc;
  }, {});

  // If you need to check dish stockStatus, populate dishId stockStatus
  // Here we check using a lookup to Dish model if the OrderItem stored dishId references exist
  const dishIds = items.map((it) => it.dishId).filter(Boolean);
  if (dishIds.length) {
    const Dish = require("../models/dishes.model");
    const dishMap = Object.fromEntries(
      (
        await Dish.find({ _id: { $in: dishIds } })
          .select("stockStatus")
          .lean()
      ).map((d) => [String(d._id), d])
    );
    // check stock
    for (const it of items) {
      const d = dishMap[String(it.dishId)];
      if (d && d.stockStatus === "OUT_OF_STOCK")
        throw ErrorCode.ORDER_HAS_OUT_OF_STOCK;
      if (d && d.deleted) throw ErrorCode.ORDER_HAS_BEEN_DELETE;
    }
  }

  // remove old cart for user/store
  const oldCart = await Cart.findOne({ userId, storeId: order.stores._id });
  if (oldCart) {
    const ids = await CartItem.find({ cartId: oldCart._id }).distinct("_id");
    if (ids && ids.length) {
      await CartItemTopping.deleteMany({ cartItemId: { $in: ids } });
    }
    await CartItem.deleteMany({ cartId: oldCart._id });
    await Cart.deleteOne({ _id: oldCart._id });
  }

  // create new cart and items
  const newCart = await Cart.create({ userId, storeId: order.stores._id });
  for (const it of items) {
    const cartItem = await CartItem.create({
      cartId: newCart._id,
      dishId: it.dishId,
      dishName: it.dishName,
      quantity: it.quantity,
      price: it.price,
      note: it.note,
      participantId: userId,
    });
    const tops = toppingByItem[String(it._id)] || [];
    if (tops.length) {
      await CartItemTopping.insertMany(
        tops.map((t) => ({
          cartItemId: cartItem._id,
          toppingId: t.toppingId,
          toppingName: t.toppingName,
          price: t.price,
        }))
      );
    }
  }

  return { success: true };
};

const cancelOrderService = async (userId, orderId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  const order = await Order.findById(orderId);
  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  if (order.userId.toString() !== userId.toString()) {
    throw ErrorCode.ORDER_CANCEL_UNAUTHORIZED;
  }

  const cancellableStatuses = ["preorder", "pending"];
  if (!cancellableStatuses.includes(order.status)) {
    throw ErrorCode.ORDER_CANNOT_CANCEL_STATUS;
  }

  await Order.findByIdAndDelete(orderId);

  return { success: true };
};

// SHIPPER SERVICES INTERACT WITH ORDERS
const takeOrderService = async (shipperId, orderId) => {
  const session = await Order.startSession();

  try {
    session.startTransaction();

    const order = await Order.findById(orderId).session(session);
    if (!order) throw ErrorCode.ORDER_NOT_FOUND;

    // ✅ Chỉ cho phép nhận khi đơn đang ở trạng thái 'finished' (hoặc 'pending' tùy logic)
    if (order.status !== "finished" && order.status !== "pending") {
      throw ErrorCode.INVALID_ORDER_STATUS;
    }

    // ✅ Kiểm tra xem đơn đã có shipper chưa
    if (order.shipperId) {
      throw ErrorCode.ORDER_ALREADY_TAKEN;
    }

    // ✅ Kiểm tra xem shipper này có nằm trong danh sách bị loại trừ không
    if (
      order.excludedShippers?.some(
        (id) => id.toString() === shipperId.toString()
      )
    ) {
      throw ErrorCode.SHIPPER_BLOCKED_FOR_THIS_ORDER;
    }

    const shipper = await Shipper.findById(shipperId).session(session);
    if (!shipper) throw ErrorCode.SHIPPER_NOT_FOUND;

    if (shipper.busy) {
      throw ErrorCode.SHIPPER_BUSY;
    }

    // ✅ Cập nhật trạng thái
    shipper.busy = true;
    await shipper.save({ session });

    order.status = "taken";
    order.shipperId = shipper._id;
    await order.save({ session });

    await session.commitTransaction();

    return { message: "Order taken successfully", order };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const startDeliveryService = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw ErrorCode.ORDER_NOT_FOUND;
  if (order.status !== "taken") {
    throw ErrorCode.INVALID_ORDER_STATUS;
  }

  order.status = "delivering";
  await order.save();

  return order;
};

const markDeliveredService = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw ErrorCode.ORDER_NOT_FOUND;
  if (order.status !== "delivering") {
    throw ErrorCode.INVALID_ORDER_STATUS;
  }

  order.status = "delivered";
  await order.save();

  return order;
};

const completeOrderService = async (shipperId, orderId) => {
  const session = await Order.startSession();

  try {
    session.startTransaction();
    const order = await Order.findById(orderId).session(session);
    if (!order) throw ErrorCode.ORDER_NOT_FOUND;

    if (order.status !== "delivered") {
      throw ErrorCode.INVALID_ORDER_STATUS;
    }
    if (
      !order.shipperId ||
      order.shipperId.toString() !== shipperId.toString()
    ) {
      throw ErrorCode.UNAUTHORIZED_SHIPPER; // shipper không phải người giao đơn này
    }

    order.status = "done";
    await order.save({ session });

    const shipper = await Shipper.findById(shipperId).session(session);
    if (!shipper) throw ErrorCode.SHIPPER_NOT_FOUND;

    shipper.busy = false;
    await shipper.save({ session });

    await OrderHistory.create(
      [
        {
          orderId,
          shipperId,
          completedAt: new Date(),
        },
      ],
      { session }
    );

    // 7️⃣ Commit transaction
    await session.commitTransaction();

    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getOngoingOrderService = async (shipperId) => {
  const ongoingStatuses = ["taken", "delivering", "delivered"];

  // 1️⃣ Tìm đơn hàng đang hoạt động
  const order = await Order.findOne({
    shipperId,
    status: { $in: ongoingStatuses },
  })
    .populate({
      path: "stores",
      select: "name avatarImage address_full location",
      populate: { path: "avatarImage", select: "url" },
    })
    .populate({
      path: "userId",
      select: "name avatar avatarImage",
      populate: { path: "avatarImage", select: "url" },
    })
    .populate({
      path: "shipInfo",
      select:
        "address detailAddress contactName contactPhonenumber note shipLocation",
    })
    .sort({ updatedAt: -1 })
    .lean();

  if (!order) return null;

  // 2️⃣ Gắn danh sách món ăn + topping + ảnh món
  const itemsByOrder = await attachItemsAndToppings([order]);

  // 3️⃣ Trả về object đầy đủ thông tin
  return {
    ...order,
    items: itemsByOrder[String(order._id)] || [],
  };
};

const getOrderDetailDirectionService = async (orderId) => {
  if (!orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  // populate store: name, avatarImage, address_full, location (lat-lon)
  const order = await Order.findById(orderId)
    .populate({
      path: "stores",
      select: "name avatarImage address_full location", // 👈 thêm 2 field này
      populate: {
        path: "avatarImage",
        select: "url",
      },
    })
    .populate({
      path: "users",
      select: "name avatar",
    })
    .lean();

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  // ship info
  const shipInfo = await OrderShipInfo.findOne({ orderId }).lean();

  // vouchers (with voucher snapshot)

  return {
    ...order,
    shipInfo: shipInfo || null,
  };
};

const getOrderHistoryByShipperService = async (
  shipperId,
  page = 1,
  limit = 10
) => {
  // 1️⃣ Kiểm tra shipper hợp lệ
  const shipper = await Shipper.findById(shipperId);
  if (!shipper) throw ErrorCode.SHIPPER_NOT_FOUND;

  // 2️⃣ Tính skip
  const skip = (page - 1) * limit;

  // 3️⃣ Đếm tổng số order done của shipper này
  const totalOrders = await Order.countDocuments({
    shipperId,
    status: "done",
  });

  // 4️⃣ Lấy danh sách order theo trang
  const orders = await Order.find({
    shipperId,
    status: "done",
  })
    .populate({
      path: "stores",
      select: "name avatarImage address_full location",
      populate: { path: "avatarImage", select: "url" },
    })
    .populate({
      path: "userId",
      select: "name avatar avatarImage",
      populate: { path: "avatarImage", select: "url" },
    })
    .populate({
      path: "shipInfo",
      select:
        "address detailAddress contactName contactPhonenumber note shipLocation",
    })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  if (!orders.length)
    return {
      page,
      limit,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      orders: [],
    };

  // 5️⃣ Gắn items & toppings
  const itemsByOrder = await attachItemsAndToppings(orders);

  // 6️⃣ Lấy completedAt từ OrderHistory
  const orderIds = orders.map((o) => o._id);
  const histories = await OrderHistory.find({ orderId: { $in: orderIds } })
    .select("orderId completedAt")
    .lean();

  const historyMap = Object.fromEntries(
    histories.map((h) => [h.orderId.toString(), h.completedAt])
  );

  // 7️⃣ Gộp dữ liệu
  const result = orders.map((o) => ({
    ...o,
    completedAt: historyMap[o._id.toString()] || null,
    items: itemsByOrder[o._id.toString()] || [],
  }));

  // 8️⃣ Trả kết quả phân trang
  return {
    orders: result,
    totalOrders,
    totalPages: Math.ceil(totalOrders / limit),
    page,
    limit,
  };
};

// Cancel order
const cancelOrderShipperService = async (shipperId, orderId) => {
  const session = await Order.startSession();

  try {
    session.startTransaction();

    const order = await Order.findById(orderId).session(session);
    if (!order) throw ErrorCode.ORDER_NOT_FOUND;

    // ✅ Chỉ cho phép hủy khi đơn đang ở trạng thái 'taken'
    if (order.status !== "taken") {
      throw ErrorCode.INVALID_ORDER_STATUS;
    }

    // ✅ Kiểm tra shipper đúng là người đã nhận đơn
    if (
      !order.shipperId ||
      order.shipperId.toString() !== shipperId.toString()
    ) {
      throw ErrorCode.UNAUTHORIZED_SHIPPER;
    }

    const shipper = await Shipper.findById(shipperId).session(session);
    if (!shipper) throw ErrorCode.SHIPPER_NOT_FOUND;

    // ✅ Cập nhật lại trạng thái đơn
    order.status = "finished";
    order.shipperId = null;

    // ✅ Thêm shipper này vào danh sách bị loại trừ (nếu chưa có)
    if (
      !order.excludedShippers.some(
        (id) => id.toString() === shipperId.toString()
      )
    ) {
      order.excludedShippers.push(shipper._id);
    }

    await order.save({ session });

    // ✅ Giải phóng shipper để nhận đơn khác
    shipper.busy = false;
    await shipper.save({ session });

    await session.commitTransaction();

    return { message: "Order canceled successfully", order };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const cancelOrderByStoreService = async (staffId, orderId) => {
  // 1️⃣ Kiểm tra tham số
  if (!staffId) throw ErrorCode.STAFF_NOT_FOUND;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId))
    throw ErrorCode.ORDER_NOT_FOUND;

  // 2️⃣ Lấy thông tin staff và store tương ứng
  const staff = await Staff.findById(staffId);
  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;

  const store = await Store.findOne({ staff: staff._id });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  // 3️⃣ Tìm đơn hàng
  const order = await Order.findById(orderId);
  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  // 4️⃣ Kiểm tra quyền sở hữu
  if (order.storeId.toString() !== store._id.toString()) {
    throw ErrorCode.ORDER_CANCEL_UNAUTHORIZED;
  }

  // 5️⃣ Kiểm tra trạng thái
  if (order.status !== "pending") {
    throw ErrorCode.ORDER_CANNOT_CANCEL_STATUS;
  }

  // 6️⃣ Cập nhật trạng thái thành cancelled
  order.status = "cancelled";
  await order.save();

  return {
    success: true,
    message: "Order cancelled successfully",
    orderId: order._id,
  };
};

module.exports = {
  getUserOrdersService,
  getOrderDetailService,
  getOrderDetailForStoreService,
  getFinishedOrdersService,
  updateOrderStatusService,
  finishOrderService,
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
  getOrderDetailDirectionService,
  getOrderHistoryByShipperService,
  cancelOrderShipperService,
  cancelOrderByStoreService,
  getOrderDetailShipperService,
  rejectOrderService,
  resendNotificationToShipperService,
  deliveryByStoreService,
};
