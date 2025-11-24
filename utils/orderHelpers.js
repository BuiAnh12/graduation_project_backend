// utils/orderHelpers.js

const mongoose = require("mongoose");
const Store = require("../models/stores.model");
const CartItem = require("../models/cart_items.model");
const CartItemTopping = require("../models/cart_item_toppings.model");
const CartParticipant = require("../models/cart_participants.model");
const CartVoucher = require("../models/cart_vouchers.model");
const Order = require("../models/orders.model");
const OrderItem = require("../models/order_items.model");
const OrderItemTopping = require("../models/order_item_toppings.model");
const OrderShipInfo = require("../models/order_ship_infos.model");
const OrderVoucher = require("../models/order_vouchers.model");
const Voucher = require("../models/vouchers.model");
const UserVoucherUsage = require("../models/user_voucher_usage.model");
const Notification = require("../models/notifications.model");
const ErrorCode = require("../constants/errorCodes.enum");
const { getNextSequence } = require("../utils/counterHelper");

// Import Socket helper (Adjust path to where your socket instance is exported)
const { getIo, storeSockets, userSockets } = require("../utils/socketManager"); 

/* ==========================================================================
   🛠️ SHARED HELPER: Prepare Items, Calculate Totals & Validate Vouchers
   ========================================================================== */
const prepareOrderData = async (cart) => {
    // 1. Fetch Items
    const cartItems = await CartItem.find({ cartId: cart._id })
        .populate({ path: "dishId", select: "name price image stockCount" })
        .lean();

    if (!cartItems.length) throw ErrorCode.CART_EMPTY;

    // 2. Fetch & Attach Toppings
    const itemToppings = await CartItemTopping.find({
        cartItemId: { $in: cartItems.map((i) => i._id) },
    })
        .populate({ path: "toppingId", select: "name price" })
        .lean();

    const itemsWithToppings = cartItems.map((item) => {
        const toppings = itemToppings.filter(
            (t) => t.cartItemId.toString() === item._id.toString()
        );
        return { ...item, toppings };
    });

    // 3. Calculate Subtotal
    let subtotalPrice = 0;
    for (const item of itemsWithToppings) {
        const dishPrice = (item.dishId?.price || 0) * item.quantity;
        const toppingsPrice =
            (item.toppings?.reduce(
                (sum, t) => sum + (t.toppingId?.price || 0),
                0
            ) || 0) * item.quantity;
        subtotalPrice += dishPrice + toppingsPrice;
    }

    // 4. Calculate Discounts (Based on Vouchers saved in Cart)
    // Note: In getQRCodeService, we saved voucher IDs to cart.voucher
    let totalDiscount = 0;
    const validVouchers = [];
    const now = new Date();
    const voucherIds = cart.voucher || [];

    for (const voucherId of voucherIds) {
        const voucher = await Voucher.findById(voucherId);
        if (!voucher || !voucher.isActive) continue;

        // Note: In a strict payment flow, we might skip date checks if payment 
        // is already successful, but keeping it ensures data integrity.
        // if (voucher.startDate > now || voucher.endDate < now) continue;
        
        // Check min order
        if (voucher.minOrderAmount && subtotalPrice < voucher.minOrderAmount) continue;

        let discount = 0;
        if (voucher.discountType === "PERCENTAGE") {
            discount = (subtotalPrice * voucher.discountValue) / 100;
            if (voucher.maxDiscount)
                discount = Math.min(discount, voucher.maxDiscount);
        } else if (voucher.discountType === "FIXED") {
            discount = voucher.discountValue;
        }
        totalDiscount += discount;
        validVouchers.push({ voucher, discount });
    }

    // 5. Final Total
    const shippingFee = cart.shippingFee || 0;
    const finalTotal = Math.max(0, subtotalPrice - totalDiscount + shippingFee);

    return {
        itemsWithToppings,
        subtotalPrice,
        totalDiscount,
        shippingFee,
        finalTotal,
        validVouchers,
    };
};

/* ==========================================================================
   📦 LOGIC 1: COMPLETE PRIVATE CART
   ========================================================================== */
const completeCartInternal = async (cart) => {
    // 1. Prepare Data
    const {
        itemsWithToppings,
        subtotalPrice,
        totalDiscount,
        shippingFee,
        finalTotal,
        validVouchers,
    } = await prepareOrderData(cart);

    const orderNumber = await getNextSequence(cart.storeId, "order");

    // 2. Create Order
    const newOrder = await Order.create({
        orderNumber,
        userId: cart.userId,
        storeId: cart.storeId,
        paymentMethod: cart.paymentMethod, // 'vnpay' or 'cash' from DB
        status: "pending", // Will be updated to 'paid' by handleVnpReturnService if successful
        subtotalPrice,
        totalDiscount,
        shippingFee,
        finalTotal,
        isGroupOrder: false,
    });

    // 3. Create Order Items
    for (const item of itemsWithToppings) {
        const orderItem = await OrderItem.create({
            orderId: newOrder._id,
            dishId: item.dishId?._id,
            dishName: item.dishId?.name || "Unknown Dish",
            price: item.dishId?.price || 0,
            quantity: item.quantity,
            note: item.note || "",
        });

        if (item.toppings?.length) {
            for (const topping of item.toppings) {
                await OrderItemTopping.create({
                    orderItemId: orderItem._id,
                    toppingId: topping.toppingId?._id,
                    toppingName: topping.toppingId?.name || "Unknown Topping",
                    price: topping.toppingId?.price || 0,
                });
            }
        }
    }

    // 4. Save Shipping Info & Vouchers
    await saveOrderAuxiliaryData(newOrder._id, cart, validVouchers);

    // 5. Cleanup & Notify
    cart.completed = true;
    cart.status = "placed";
    await cart.save();

    await sendNotifications(newOrder, cart.storeId, cart.userId);

    return { orderId: newOrder._id, finalTotal: newOrder.finalTotal };
};

/* ==========================================================================
   👥 LOGIC 2: COMPLETE GROUP CART
   ========================================================================== */
const completeGroupCartInternal = async (cart) => {
    // 1. Get Participants
    const participants = await CartParticipant.find({ cartId: cart._id, status: { $in: ["active", "locking"] } });
    
    // 2. Prepare Data
    const {
        itemsWithToppings,
        subtotalPrice,
        totalDiscount,
        shippingFee,
        finalTotal,
        validVouchers,
    } = await prepareOrderData(cart);

    const orderNumber = await getNextSequence(cart.storeId, "order");

    // 3. Create Order (With Group Flags)
    const newOrder = await Order.create({
        orderNumber,
        userId: cart.userId, // Owner
        storeId: cart.storeId,
        paymentMethod: cart.paymentMethod,
        status: "pending",
        subtotalPrice,
        totalDiscount,
        shippingFee,
        finalTotal,
        isGroupOrder: true,
        participants: participants.map((p) => p._id),
    });

    // 4. Create Order Items (With Participant Mapping)
    for (const item of itemsWithToppings) {
        // Calculate line totals for group breakdown logic later
        const p_dishPrice = item.dishId?.price || 0;
        const p_toppingsTotal_per_item = item.toppings?.reduce((sum, t) => sum + (t.toppingId?.price || 0), 0) || 0;
        const p_toppingsTotal_all_quantity = p_toppingsTotal_per_item * item.quantity;
        const p_lineSubtotal = p_dishPrice * item.quantity;
        const p_lineTotal = p_lineSubtotal + p_toppingsTotal_all_quantity;

        const orderItem = await OrderItem.create({
            orderId: newOrder._id,
            dishId: item.dishId?._id,
            participantId: item.participantId, // <<< LINK TO PARTICIPANT
            dishName: item.dishId?.name || "Unknown Dish",
            price: item.dishId?.price || 0,
            quantity: item.quantity,
            note: item.note || "",
            toppingsTotal: p_toppingsTotal_all_quantity,
            lineSubtotal: p_lineSubtotal,
            lineTotal: p_lineTotal,
        });

        if (item.toppings?.length) {
            for (const topping of item.toppings) {
                await OrderItemTopping.create({
                    orderItemId: orderItem._id,
                    toppingId: topping.toppingId?._id,
                    toppingName: topping.toppingId?.name || "Unknown Topping",
                    price: topping.toppingId?.price || 0,
                });
            }
        }
    }

    // 5. Save Shipping Info & Vouchers
    await saveOrderAuxiliaryData(newOrder._id, cart, validVouchers);

    // 6. Cleanup & Notify
    await CartParticipant.updateMany(
        { cartId: cart._id },
        { $set: { status: "completed" } }
    );

    cart.completed = true;
    cart.status = "placed";
    await cart.save();

    await sendNotifications(newOrder, cart.storeId, cart.userId, true); // true = isGroup

    return { orderId: newOrder._id, finalTotal: newOrder.finalTotal };
};

/* ==========================================================================
   🛠️ HELPER: Save Ship Info, Vouchers & Send Notifications
   ========================================================================== */
const saveOrderAuxiliaryData = async (orderId, cart, validVouchers) => {
    // 1. Shipping Info (From populated cart.location)
    if (cart.location) {
        await OrderShipInfo.create({
            orderId,
            shipLocation: cart.location.location, // GeoJSON
            address: cart.location.address,
            detailAddress: cart.location.detailAddress,
            contactName: cart.location.contactName,
            contactPhonenumber: cart.location.contactPhonenumber,
            note: cart.location.note,
        });
    }

    // 2. Order Vouchers & Usage
    for (const { voucher, discount } of validVouchers) {
        await OrderVoucher.create({
            orderId,
            voucherId: voucher._id,
            discountAmount: discount,
        });

        voucher.usedCount = (voucher.usedCount || 0) + 1;
        await voucher.save();

        await UserVoucherUsage.findOneAndUpdate(
            { userId: cart.userId, voucherId: voucher._id },
            { $inc: { usedCount: 1 }, startDate: voucher.startDate },
            { upsert: true, new: true }
        );
    }
};

const sendNotifications = async (order, storeId, userId, isGroup = false) => {
    // 1. Notify Store Owner
    const store = await Store.findById(storeId);
    if (store?.owner) {
        await Notification.create({
            userId: store.owner,
            orderId: order._id,
            title: isGroup ? "Có đơn hàng nhóm mới" : "Có đơn hàng mới",
            message: "Hãy xác nhận đơn hàng ngay!",
            type: "newOrder",
            status: "unread",
        });
    }

    // Socket to Store
    try {
        const io = getIo();
        if (io && storeSockets[storeId]) {
            storeSockets[storeId].forEach((socketId) => {
                io.to(socketId).emit("newOrderNotification", {
                    orderId: order._id,
                    userId,
                    finalTotal: order.finalTotal,
                    status: order.status,
                    isGroupOrder: isGroup,
                });
            });
        }
    } catch (e) {
        console.log("Socket error (store):", e.message);
    }

    // 2. Notify User (Owner)
    await Notification.create({
        userId: userId,
        orderId: order._id,
        title: "Đặt hàng thành công",
        message: "Đơn hàng của bạn đã được tạo thành công.",
        type: "newOrder",
        status: "unread",
    });

    // Socket to User
    try {
        const io = getIo();
        if (io && userSockets[userId]) {
            userSockets[userId].forEach((socketId) => {
                io.to(socketId).emit("newOrderNotification", {
                    orderId: order._id,
                    userId,
                    finalTotal: order.finalTotal,
                    status: order.status,
                });
            });
        }
    } catch (e) {
        console.log("Socket error (user):", e.message);
    }
};

module.exports = {
    completeCartInternal,
    completeGroupCartInternal,
};