const mongoose = require("mongoose");
const Order = require("../models/order.model");
const OrderItem = require("../models/orderItem.model");
const OrderItemTopping = require("../models/orderItemTopping.model");
const OrderShipInfo = require("../models/orderShipInfo.model");
const OrderVoucher = require("../models/orderVoucher.model");
const Cart = require("../models/cart.model");
const CartItem = require("../models/cartItem.model");
const CartItemTopping = require("../models/cartItemTopping.model");
const Payment = require("../models/payment.model");
const { VNPay, ignoreLogger, dateFormat } = require("vnpay");
const ErrorCode = require("../constants/errorCodes.enum");
const { getPaginatedData } = require("../utils/paging");

function calcLineSubtotal(item) {
  const base = Number(item.price || 0);
  const qty = Number(item.quantity || 0);
  const tops = Array.isArray(item.toppings) ? item.toppings : [];
  const topsSum = tops.reduce((s, t) => s + Number(t.price || 0), 0);
  return qty * (base + topsSum);
}

// ====== SERVICE IMPLEMENTATIONS ======

const getUserOrdersService = async (userId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;

  const orders = await Order.find({ userId })
    .populate({ path: "store", select: "name avatar status" })
    .populate({
      path: "items",
      populate: [{ path: "dish", select: "name price image" }, { path: "toppings" }],
    })
    .populate({ path: "user", select: "name avatar" })
    .sort({ updatedAt: -1 })
    .lean();

  const filtered = orders.filter((o) => o.store?.status === "APPROVED");
  if (!filtered.length) throw ErrorCode.ORDER_NOT_FOUND;

  const shipInfos = await OrderShipInfo.find({ orderId: { $in: filtered.map((o) => o._id) } }).lean();
  const shipMap = Object.fromEntries(shipInfos.map((i) => [i.orderId.toString(), i]));

  return filtered.map((o) => ({ ...o, shipInfo: shipMap[o._id.toString()] || null }));
};

const getOrderDetailService = async (orderId) => {
  if (!orderId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const order = await Order.findById(orderId)
    .populate({ path: "store", select: "name avatar" })
    .populate({
      path: "items",
      populate: [
        { path: "dish", select: "name price image description" },
        { path: "toppings", select: "toppingName price" },
      ],
    })
    .lean();

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  const shipInfo = await OrderShipInfo.findOne({ orderId }).lean();
  const vouchers = await OrderVoucher.find({ orderId })
    .populate({ path: "voucherId", select: "code description discountType discountValue maxDiscount" })
    .lean();

  return { ...order, shipInfo: shipInfo || null, vouchers: vouchers || [] };
};

const getOrderDetailForStoreService = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate({ path: "store", select: "name avatar" })
    .populate({ path: "user", select: "name avatar" })
    .populate({
      path: "items",
      populate: [
        { path: "dish", select: "name price image description" },
        { path: "toppings", select: "toppingName price" },
      ],
    })
    .lean();

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  const shipInfo = await OrderShipInfo.findOne({ orderId }).lean();
  return { ...order, shipInfo: shipInfo || null };
};

const getFinishedOrdersService = async () => {
  const finished = await Order.find({ status: "finished" })
    .populate({ path: "store", select: "name avatar" })
    .populate({ path: "user", select: "name avatar" })
    .populate({
      path: "items",
      populate: [{ path: "dish", select: "name image price" }, { path: "toppings" }],
    })
    .sort({ updatedAt: -1 })
    .lean();

  return finished;
};

const updateOrderStatusService = async (orderId, status) => {
  const order = await Order.findById(orderId)
    .populate({ path: "store", select: "name avatar" })
    .populate({ path: "user", select: "name avatar" });

  if (!order) throw ErrorCode.ORDER_NOT_FOUND;

  const transitions = { taken: ["delivering", "finished", "done"], delivering: ["delivered"], finished: ["done"] };
  if (status === order.status) throw ErrorCode.ORDER_STATUS_ALREADY_SET;
  if (!transitions[order.status] || !transitions[order.status].includes(status)) {
    throw ErrorCode.INVALID_STATUS_TRANSITION;
  }

  order.status = status;
  await order.save();

  return await Order.findById(orderId)
    .populate({ path: "store", select: "name avatar" })
    .populate({ path: "user", select: "name avatar" })
    .populate({ path: "items", populate: { path: "toppings", select: "toppingName price" } })
    .lean();
};

const getOrderStatsService = async () => {
  const totalOrders = await Order.countDocuments();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);

  const ordersThisMonth = await Order.countDocuments({ createdAt: { $gte: startOfMonth, $lt: endOfMonth } });
  return { totalOrders, ordersThisMonth };
};

const getMonthlyOrderStatsService = async () => {
  const stats = await Order.aggregate([{ $group: { _id: { $month: "$createdAt" }, total: { $sum: 1 } } }]);
  return Array.from({ length: 12 }, (_, i) => {
    const stat = stats.find((s) => s._id === i + 1);
    return { name: `Tháng ${i + 1}`, total: stat ? stat.total : 0 };
  });
};

const getAllOrderService = async (storeId, { status, limit, page, name }) => {
  const filter = { storeId };
  if (status) filter.status = { $in: Array.isArray(status) ? status : status.split(",") };
  if (name?.trim()) {
    const regex = new RegExp(name, "i");
    filter.$or = [{ customerName: regex }, { customerPhonenumber: regex }];
  }

  const result = await getPaginatedData(
    Order,
    filter,
    [
      { path: "store", select: "name avatar" },
      { path: "user", select: "name email avatar" },
      {
        path: "items",
        populate: [{ path: "dish", select: "name price image description" }, { path: "toppings" }],
      },
    ],
    limit,
    page
  );

  if (name?.trim()) {
    const regex = new RegExp(name, "i");
    result.data = result.data.filter(
      (o) => o.user?.name?.match(regex) || o.customerName?.match(regex) || o.customerPhonenumber?.match(regex)
    );
  }
  return result;
};

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
        if (!it.dishId || !it.dishName || !it.quantity || !it.price) throw ErrorCode.ORDER_INVALID_ITEM;

        const doc = { orderId, dishId: it.dishId, dishName: it.dishName, quantity: it.quantity, price: it.price, note: it.note || "" };
        let itemDoc;
        if (it._id && existingMap.has(String(it._id))) {
          itemDoc = await OrderItem.findByIdAndUpdate(it._id, { $set: doc }, { new: true, session });
        } else {
          itemDoc = await OrderItem.create([doc], { session }).then((arr) => arr[0]);
        }
        kept.push(itemDoc._id);

        await OrderItemTopping.deleteMany({ orderItemId: itemDoc._id }).session(session);
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

      const toDelete = existing.filter((e) => !kept.includes(String(e._id))).map((e) => e._id);
      if (toDelete.length) {
        await OrderItemTopping.deleteMany({ orderItemId: { $in: toDelete } }).session(session);
        await OrderItem.deleteMany({ _id: { $in: toDelete } }).session(session);
      }

      let subtotal = 0;
      for (const it of incoming) subtotal += calcLineSubtotal(it);
      const shipping = Number(payload.shippingFee ?? order.shippingFee ?? 0);
      const discount = Number(payload.totalDiscount ?? order.totalDiscount ?? 0);
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

const reOrderService = async (userId, orderId) => {
  if (!userId) throw ErrorCode.USER_NOT_FOUND;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) throw ErrorCode.ORDER_NOT_FOUND;

  const order = await Order.findById(orderId).populate("store").populate({
    path: "items",
    populate: [{ path: "dish", select: "stockStatus" }, { path: "toppings" }],
  });

  if (!order || !order.store) throw ErrorCode.ORDER_NOT_FOUND;
  if (order.store.status === "BLOCKED") throw ErrorCode.STORE_BLOCKED;

  if (order.items.some((i) => i.dish?.stockStatus === "OUT_OF_STOCK")) throw ErrorCode.ORDER_HAS_OUT_OF_STOCK;

  const oldCart = await Cart.findOne({ userId, storeId: order.store._id });
  if (oldCart) {
    const ids = await CartItem.find({ cartId: oldCart._id }).distinct("_id");
    await CartItemTopping.deleteMany({ cartItemId: { $in: ids } });
    await CartItem.deleteMany({ cartId: oldCart._id });
    await Cart.deleteOne({ _id: oldCart._id });
  }

  const newCart = await Cart.create({ userId, storeId: order.store._id });
  for (const it of order.items) {
    const cartItem = await CartItem.create({
      cartId: newCart._id,
      dishId: it.dishId,
      dishName: it.dishName,
      quantity: it.quantity,
      price: it.price,
      note: it.note,
    });
    if (it.toppings?.length) {
      await CartItemTopping.insertMany(
        it.toppings.map((t) => ({ cartItemId: cartItem._id, toppingId: t.toppingId, toppingName: t.toppingName, price: t.price }))
      );
    }
  }
  return { success: true };
};

module.exports = {
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
};
