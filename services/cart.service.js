const ErrorCode = require("../constants/errorCodes.enum");
const Cart = require("../models/carts.model");
const CartItem = require("../models/cart_items.model");
const CartItemTopping = require("../models/cart_item_toppings.model");
const Dish = require("../models/dishes.model");
const Topping = require("../models/toppings.model");
const ToppingGroup = require("../models/topping_groups.model");
const Voucher = require("../models/vouchers.model");
const UserVoucherUsage = require("../models/user_voucher_usage.model");
const Store = require("../models/stores.model");
const Rating = require("../models/ratings.model");
const CartParticipant = require("../models/cart_participants.model");
const Order = require("../models/orders.model");
const OrderItem = require("../models/order_items.model");
const OrderItemTopping = require("../models/order_item_toppings.model");
const OrderShipInfo = require("../models/order_ship_infos.model");
const OrderVoucher = require("../models/order_vouchers.model");
const Notification = require("../models/notifications.model");
const { getNextSequence } = require("../utils/counterHelper");

const { getStoreSockets, getIo } = require("../utils/socketManager");
const storeSockets = getStoreSockets();

const REFRESH_NONE = null;

/**
 * Helper: check dish stock.
 * - If dish.stockCount === -1 => unlimited (skip)
 * - Otherwise ensure requestedQty <= stockCount
 */
const ensureStockAvailable = async (dishId, requestedQty) => {
    const dish = await Dish.findById(dishId).lean();
    if (!dish) throw ErrorCode.MISSING_REQUIRED_FIELDS;

    if (typeof dish.stockCount === "number" && dish.stockCount !== -1) {
        if (requestedQty > dish.stockCount) {
            return false;
        }
    }
    return true;
};

/**
 * Get all carts for a user (only approved store carts)
 */
const getUserCarts = async (userId) => {
    if (!userId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

    // Step 1: Get carts of user
    const carts = await Cart.find({ userId })
        .populate({
            path: "storeId",
            select: "name status openStatus avatarImage coverImage systemCategoryId",
            populate: [
                { path: "systemCategoryId", select: "name image" },
                { path: "avatarImage coverImage", select: "url" },
            ],
        })
        .populate({
            path: "userId",
            select: "name email phonenumber avatarImage",
            populate: { path: "avatarImage", select: "url" },
        })
        .lean();

    if (!carts) throw ErrorCode.CART_NOT_FOUND;
    if (carts.length === 0) throw ErrorCode.CART_EMPTY;

    // Step 2: Only APPROVED stores
    const approvedCarts = carts.filter(
        (c) =>
            c.storeId?.status?.toUpperCase() === "APROVE" ||
            c.storeId?.status?.toUpperCase() === "APPROVED"
    );

    // Step 3: Get cart items (from cart_items collection)
    const cartIds = approvedCarts.map((c) => c._id);

    const items = await CartItem.find({ cartId: { $in: cartIds } })
        .populate({
            path: "dishId",
            select: "name price image description stockCount stockStatus",
            populate: { path: "image", select: "url" },
        })
        .populate({
            path: "participantId",
            select: "userId isOwner",
            populate: {
                path: "userId",
                select: "name email avatarImage",
                populate: { path: "avatarImage", select: "url" },
            },
        })
        .lean();

    // Step 4: Get toppings for items
    const itemToppings = await CartItemTopping.find({
        cartItemId: { $in: items.map((i) => i._id) },
    })
        .populate({
            path: "toppingId",
            select: "name price",
        })
        .lean();

    // Attach toppings to items
    const itemsWithToppings = items.map((item) => {
        const toppings = itemToppings.filter(
            (t) => t.cartItemId.toString() === item._id.toString()
        );
        return { ...item, toppings };
    });

    // Step 5: Compute store ratings
    const storeRatings = await Rating.aggregate([
        {
            $group: {
                _id: "$storeId",
                avgRating: { $avg: "$ratingValue" },
                amountRating: { $sum: 1 },
            },
        },
    ]);

    // Step 6: Merge everything
    const updatedCarts = approvedCarts.map((cart) => {
        const rating = storeRatings.find(
            (r) => r._id.toString() === cart.storeId._id.toString()
        );

        return {
            ...cart,
            store: {
                ...cart.storeId,
                avgRating: rating?.avgRating || 0,
                amountRating: rating?.amountRating || 0,
            },
            items: itemsWithToppings.filter(
                (item) => item.cartId.toString() === cart._id.toString()
            ),
        };
    });

    return updatedCarts;
};

/**
 * Get detailed cart by id (ensure ownership)
 */
const getCartDetail = async (userId, cartId) => {
    if (!userId || !cartId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

    const cart = await Cart.findOne({ userId })
        .populate({
            path: "storeId",
            select: "name status openStatus avatarImage coverImage systemCategoryId",
            populate: [
                { path: "systemCategoryId", select: "name image" },
                { path: "avatarImage coverImage", select: "url" },
                { path: "location"}
            ],
        })
        .populate({
            path: "userId",
            select: "name email phonenumber avatarImage",
            populate: { path: "avatarImage", select: "url" },
        })
        .lean();
    if (!cart || cart.completed === true) throw ErrorCode.CART_NOT_FOUND;
    if (cart.userId._id.toString() !== userId.toString())
        throw ErrorCode.USER_CART_MISSMATCH;

    // fetch items separately
    const items = await CartItem.find({ cartId })
        .populate({
            path: "dishId",
            select: "name price image description stockCount stockStatus",
            populate: { path: "image", select: "url" },
        })
        .lean();

    const toppings = await CartItemTopping.find({
        cartItemId: { $in: items.map((i) => i._id) },
    })
        .populate({ path: "toppingId", select: "name price" })
        .lean();

    const itemsWithToppings = items.map((i) => ({
        ...i,
        toppings: toppings.filter(
            (t) => t.cartItemId.toString() === i._id.toString()
        ),
    }));

    return {
        cartId: cart._id,
        store: cart.storeId,
        items: itemsWithToppings,
    };
};

/**
 * Create or join a cart.
 * For simplicity: create a cart document if not exist.
 * Join/leave semantics for shared carts can be implemented later.
 */
const createOrGetCart = async (userId, storeId) => {
    if (!userId || !storeId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

    let cart = await Cart.findOne({ userId, storeId, completed: false });
    if (!cart) {
        cart = await Cart.create({
            userId,
            storeId,
            mode: "private" /* default per design */,
        });
    }
    return cart;
};

/**
 * Add / update / remove item and toppings
 * `action`: 'add_item' | 'update_item' | 'remove_item'
 * body contains: storeId, dishId, quantity, toppings[], note
 */
const upsertCartItem = async ({
    userId,
    storeId,
    dishId,
    quantity = 1,
    toppings = [],
    note = "",
    action = "add_item",
}) => {
    if (!userId) throw ErrorCode.VALIDATION_ERROR;
    if (!storeId || !dishId) throw ErrorCode.VALIDATION_ERROR;

    const dish = await Dish.findById(dishId);
    if (!dish || dish.storeId.toString() !== storeId.toString())
        throw ErrorCode.VALIDATION_ERROR;

    // validate toppings belong to store's topping groups
    if (toppings && toppings.length > 0) {
        const toppingGroups = await ToppingGroup.find({ storeId }).select(
            "_id"
        );
        const toppingGroupIds = toppingGroups.map((g) => g._id);
        const validToppings = await Topping.find({
            toppingGroupId: { $in: toppingGroupIds },
        });
        const validToppingIds = new Set(
            validToppings.map((t) => t._id.toString())
        );
        const invalid = toppings.filter(
            (tid) => !validToppingIds.has(tid.toString())
        );
        if (invalid.length > 0) {
            const err = Object.assign({}, ErrorCode.VALIDATION_ERROR, {
                message: "Some toppings are not valid for this store",
            });
            throw err;
        }
    }

    // create cart if not exist
    let cart = await Cart.findOne({ userId, storeId });
    if (!cart) {
        if (
            action === "remove_item" ||
            (action === "update_item" && quantity === 0)
        ) {
            // nothing to remove
            return { message: "Nothing to remove" };
        }
        cart = await Cart.create({ userId, storeId, mode: "private" });
    }

    // Stock enforcement: check current cart item + requested change doesn't exceed stock
    const existingCartItem = await CartItem.findOne({
        cartId: cart._id,
        dishId,
    });

    let newQty = quantity;
    if (existingCartItem && action === "add_item") {
        newQty = existingCartItem.quantity + quantity;
    } else if (action === "update_item") {
        newQty = quantity;
    } else if (action === "remove_item") {
        newQty = 0;
    }

    // if dish.stockCount !== -1 then enforce
    if (typeof dish.stockCount === "number" && dish.stockCount !== -1) {
        if (newQty > dish.stockCount) {
            const err = Object.assign({}, ErrorCode.VALIDATION_ERROR, {
                message: `Not enough stock for "${dish.name}". Available: ${dish.stockCount}`,
            });
            throw err;
        }
    }

    // perform action
    if (existingCartItem) {
        if (newQty === 0) {
            // delete item and toppings
            await CartItemTopping.deleteMany({
                cartItemId: existingCartItem._id,
            });
            await CartItem.deleteOne({ _id: existingCartItem._id });
        } else {
            existingCartItem.quantity = newQty;
            existingCartItem.note = note || existingCartItem.note;
            await existingCartItem.save();

            // rebuild toppings
            await CartItemTopping.deleteMany({
                cartItemId: existingCartItem._id,
            });
            for (const toppingId of toppings) {
                const topping = await Topping.findById(toppingId);
                if (topping) {
                    await CartItemTopping.create({
                        cartItemId: existingCartItem._id,
                        toppingId: topping._id,
                        toppingName: topping.name,
                        price: topping.price,
                    });
                }
            }
        }
    } else {
        // no existing item
        if (newQty > 0) {
            const created = await CartItem.create({
                cartId: cart._id,
                dishId: dish._id,
                dishName: dish.name,
                quantity: newQty,
                price: dish.price,
                participantId: userId,
                note,
            });

            for (const toppingId of toppings) {
                const topping = await Topping.findById(toppingId);
                if (topping) {
                    await CartItemTopping.create({
                        cartItemId: created._id,
                        toppingId: topping._id,
                        toppingName: topping.name,
                        price: topping.price,
                    });
                }
            }
        } else {
            // nothing to do
        }
    }

    // If cart now empty -> delete it
    const remainingItems = await CartItem.find({ cartId: cart._id });
    if (!remainingItems.length) {
        await Cart.findByIdAndDelete(cart._id);
        return { message: "Cart deleted because it's empty" };
    }

    // optional: emit cart update event to store/socket
    try {
        const io = getIo();
        if (storeSockets[storeId]) {
            storeSockets[storeId].forEach((socketId) => {
                io.to(socketId).emit("cartUpdated", {
                    storeId,
                    userId,
                    cartId: cart._id,
                });
            });
        }
    } catch (e) {
        console.log(e);
        // swallow socket errors
    }

    return { message: "Cart updated successfully" };
};

/**
 * Apply or remove voucher on cart.
 * action: 'apply_voucher' | 'remove_voucher'
 * expects voucherCode or voucherId depending on client.
 */
const applyRemoveVoucher = async ({
    userId,
    storeId,
    voucherId,
    action = "apply_voucher",
}) => {
    if (!userId || !storeId) throw ErrorCode.VALIDATION_ERROR;

    const cart = await Cart.findOne({ userId, storeId });
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    if (action === "apply_voucher") {
        const voucher = await Voucher.findById(voucherId);
        if (!voucher || !voucher.isActive) {
            const err = Object.assign({}, ErrorCode.VALIDATION_ERROR, {
                message: "Voucher invalid or inactive",
            });
            throw err;
        }
        // check date & min order amount etc. (client should send subtotal if needed)
        // Keep a simple apply behavior: add voucher id to cart.vouchers array
        cart.vouchers = cart.vouchers || [];
        if (
            !cart.vouchers.find((v) => v.toString() === voucher._id.toString())
        ) {
            cart.vouchers.push(voucher._id);
            await cart.save();
        }
        return { message: "Voucher applied" };
    } else {
        // remove
        cart.vouchers = (cart.vouchers || []).filter(
            (v) => v.toString() !== voucherId.toString()
        );
        await cart.save();
        return { message: "Voucher removed" };
    }
};

/**
 * Clear cart items for a store
 */
const clearCartItemForStore = async (userId, storeId) => {
    if (!userId || !storeId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

    const cart = await Cart.findOne({ userId, storeId });
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    const cartItems = await CartItem.find({ cartId: cart._id });
    const cartItemIds = cartItems.map((i) => i._id);

    await CartItemTopping.deleteMany({ cartItemId: { $in: cartItemIds } });
    await CartItem.deleteMany({ cartId: cart._id });
    await Cart.deleteOne({ _id: cart._id });

    return { message: "Cart for store cleared successfully" };
};

/**
 * Clear all carts for user
 */
const clearAllCarts = async (userId) => {
    if (!userId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

    const carts = await Cart.find({ userId });
    const cartIds = carts.map((c) => c._id);

    const cartItems = await CartItem.find({ cartId: { $in: cartIds } });
    const cartItemIds = cartItems.map((i) => i._id);

    await CartItemTopping.deleteMany({ cartItemId: { $in: cartItemIds } });
    await CartItem.deleteMany({ cartId: { $in: cartIds } });
    await Cart.deleteMany({ userId });

    return { message: "All carts cleared successfully" };
};

/**
 * Complete cart => create order.
 * I left heavy logic minimal here; your existing completeCart implementation was robust.
 * We'll re-use the same flow: compute subtotal, validate vouchers, create order and order items, save order ship info,
 * increment voucher usage, clear cart, notify store via socket.
 *
 * Note: this service returns the created order id on success.
 */
const completeCart = async ({
    userId,
    storeId,
    paymentMethod,
    customerName,
    customerPhonenumber,
    deliveryAddress,
    detailAddress,
    note,
    location = [],
    shippingFee = 0,
    vouchers = [],
}) => {
    if (!userId) throw ErrorCode.VALIDATION_ERROR;
    if (
        !storeId ||
        !paymentMethod ||
        !deliveryAddress ||
        !Array.isArray(location) ||
        location.length !== 2
    ) {
        throw ErrorCode.VALIDATION_ERROR;
    }

    const cart = await Cart.findOne({ userId, storeId });
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    // get cart items
    const cartItems = await CartItem.find({ cartId: cart._id })
        .populate({
            path: "dishId",
            select: "name price image stockCount stockStatus",
        })
        .lean();

    if (!cartItems.length) throw ErrorCode.CART_EMPTY;

    // get toppings for these items
    const itemToppings = await CartItemTopping.find({
        cartItemId: { $in: cartItems.map((i) => i._id) },
    })
        .populate({ path: "toppingId", select: "name price" })
        .lean();

    // attach toppings to items
    const itemsWithToppings = cartItems.map((item) => {
        const toppings = itemToppings.filter(
            (t) => t.cartItemId.toString() === item._id.toString()
        );
        return { ...item, toppings };
    });

    // compute subtotal
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

    // validate vouchers & compute discounts
    let totalDiscount = 0;
    const validVouchers = [];
    const now = new Date();

    for (const voucherId of vouchers) {
        const voucher = await Voucher.findById(voucherId);
        if (!voucher || !voucher.isActive) continue;
        if (voucher.startDate > now || voucher.endDate < now) continue;
        if (voucher.minOrderAmount && subtotalPrice < voucher.minOrderAmount)
            continue;

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

    const finalTotal = Math.max(0, subtotalPrice - totalDiscount + shippingFee);

    const orderNumber = await getNextSequence(storeId, "order");

    // create order
    const newOrder = await Order.create({
        orderNumber,
        userId,
        storeId,
        paymentMethod,
        status: "pending",
        subtotalPrice,
        totalDiscount,
        shippingFee,
        finalTotal,
    });

    // create order items + toppings
    for (const item of itemsWithToppings) {
        const orderItem = await OrderItem.create({
            orderId: newOrder._id,
            dishId: item.dishId?._id,
            dishName: item.dishId?.name || "",
            price: item.dishId?.price || 0,
            quantity: item.quantity,
            note: item.note || "",
        });

        if (Array.isArray(item.toppings) && item.toppings.length) {
            for (const topping of item.toppings) {
                await OrderItemTopping.create({
                    orderItemId: orderItem._id,
                    toppingId: topping.toppingId?._id,
                    toppingName: topping.toppingId?.name || "",
                    price: topping.toppingId?.price || 0,
                });
            }
        }
    }

    // shipping info
    await OrderShipInfo.create({
        orderId: newOrder._id,
        shipLocation: { type: "Point", coordinates: location },
        address: deliveryAddress,
        detailAddress,
        contactName: customerName,
        contactPhonenumber: customerPhonenumber,
        note,
    });

    // order vouchers
    for (const { voucher, discount } of validVouchers) {
        await OrderVoucher.create({
            orderId: newOrder._id,
            voucherId: voucher._id,
            discountAmount: discount,
        });

        voucher.usedCount = (voucher.usedCount || 0) + 1;
        await voucher.save();

        await UserVoucherUsage.findOneAndUpdate(
            { userId, voucherId: voucher._id },
            { $inc: { usedCount: 1 }, startDate: voucher.startDate },
            { upsert: true, new: true }
        );
    }

    // mark cart completed
    cart.completed = true;
    await cart.save();

    // notify store owner
    const store = await Store.findById(storeId);
    await Notification.create({
        userId: store.owner,
        orderId: newOrder._id,
        title: "New Order has been placed",
        message: "You have a new order!",
        type: "order",
        status: "unread",
    });

    try {
        const io = getIo();
        if (storeSockets[storeId]) {
            storeSockets[storeId].forEach((socketId) => {
                io.to(socketId).emit("newOrderNotification", {
                    orderId: newOrder._id,
                    userId,
                    finalTotal,
                    status: newOrder.status,
                });
            });
        }
    } catch (e) {
        // swallow socket errors
    }

    return { orderId: newOrder._id };
};

// ===== Cart Participation =====
const joinCartService = async ({ cartId, participant }) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    // Check participant uniqueness
    const existing = await CartParticipant.findOne({
        cartId,
        $or: [
            participant.userId ? { userId: participant.userId } : {},
            participant.participantName
                ? { participantName: participant.participantName }
                : {},
        ],
    });
    if (existing) throw ErrorCode.ALREADY_IN_CART;

    // Create participant
    return await CartParticipant.create({ cartId, ...participant });
};

const leaveCartService = async ({ cartId, participantId, userId = null }) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    const condition = { _id: participantId, cartId };
    if (userId) condition.userId = userId; // enforce self removal

    const removed = await CartParticipant.findOneAndDelete(condition);
    if (!removed) throw ErrorCode.NOT_PARTICIPANT;

    return removed;
};

// ===== Voucher Handling =====
const applyVoucherService = async (cartId, voucherCode) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    const items = await CartItem.find({ cartId }).lean();
    const toppings = await CartItemTopping.find({
        cartItemId: { $in: items.map((i) => i._id) },
    }).lean();

    let subtotal = 0;
    for (const item of items) {
        const dish = await Dish.findById(item.dishId).lean();
        const dishPrice = (dish?.price || 0) * item.quantity;
        const toppingPrice =
            toppings
                .filter((t) => t.cartItemId.toString() === item._id.toString())
                .reduce((sum, t) => sum + (t.price || 0), 0) * item.quantity;
        subtotal += dishPrice + toppingPrice;
    }

    const voucher = await Voucher.findOne({ code: voucherCode });
    if (!voucher || !voucher.active) throw ErrorCode.VOUCHER_INVALID;

    if (voucher.minSpend && subtotal < voucher.minSpend) {
        throw ErrorCode.VOUCHER_INVALID;
    }

    cart.voucherId = voucher._id;
    await cart.save();
    return cart;
};

const removeVoucherService = async (cartId) => {
  const cart = await Cart.findById(cartId);
  if (!cart) throw ErrorCode.CART_NOT_FOUND;

  cart.voucherId = null;
  await cart.save();
  return cart;
}

module.exports = {
    getUserCarts,
    getCartDetail,
    createOrGetCart,
    upsertCartItem,
    applyRemoveVoucher,
    clearCartItemForStore,
    clearAllCarts,
    completeCart,
    joinCartService,
    leaveCartService,
    applyVoucherService,
    removeVoucherService
};
