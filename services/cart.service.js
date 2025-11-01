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
    const carts = await Cart.find({ userId,  completed: { $ne: true } })
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

    const cart = await Cart.findById(cartId)
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
    // --- 1. Initial Validations ---
    if (!userId) throw ErrorCode.VALIDATION_ERROR;
    if (!storeId || !dishId) throw ErrorCode.VALIDATION_ERROR;

    const dish = await Dish.findById(dishId);
    if (!dish || dish.storeId.toString() !== storeId.toString()) {
        console.error("Dish validation failed:", { dishId, storeId, dish });
        throw ErrorCode.VALIDATION_ERROR;
    }

    // Validate toppings (ensure they belong to the store)
    if (toppings && toppings.length > 0) {
        // 1. Find all ToppingGroup IDs associated with the storeId
        const storeToppingGroups = await ToppingGroup.find({ storeId }).select("_id").lean(); // Use .lean() for performance
        const validToppingGroupIds = storeToppingGroups.map(group => group._id); // Get an array of ObjectId
    
        // Check if any topping groups were found for the store
        if (validToppingGroupIds.length === 0) {
             console.error(`No topping groups found for storeId: ${storeId}`);
             const err = Object.assign({}, ErrorCode.VALIDATION_ERROR, {
                 message: "No toppings are configured for this store",
             });
             throw err;
        }
    
        // 2. Find all Topping IDs that belong to those valid ToppingGroups
        const validStoreToppings = await Topping.find({
            toppingGroupId: { $in: validToppingGroupIds } // Check if topping belongs to any of the store's groups
        }).select("_id").lean(); // Use .lean()
    
        const validStoreToppingIds = new Set(
            validStoreToppings.map((t) => t._id.toString()) // Create a Set of valid topping ID strings
        );
        console.log(toppings)
        console.log(validStoreToppingIds)
    
        // 3. Check the input toppings against the valid set
        const invalidToppings = toppings.filter(
            (tid) => !validStoreToppingIds.has(tid.toString()) // Ensure comparison is string vs string
        );
        console.log(invalidToppings)
    
        // 4. Throw error if any invalid toppings are found
        if (invalidToppings.length > 0) {
            console.error("Invalid toppings found:", invalidToppings);
            const err = Object.assign({}, ErrorCode.VALIDATION_ERROR, {
                message: "Some toppings provided are not valid for this store's topping groups",
            });
            throw err;
        }
    
        // If we reach here, all provided toppings are valid for the store
        console.log("All provided toppings are valid for the store.");
    }

    // --- 2. Find Existing Cart and Item (Read Only) ---
    let cart = await Cart.findOne({ userId, storeId, completed: { $ne: true }});
    let existingCartItem = null;
    if (cart) {
        existingCartItem = await CartItem.findOne({
            cartId: cart._id,
            dishId,
        });
    }

    // --- 3. Calculate Target Quantity ---
    let newQty = quantity; // Default for update_item or initial add
    if (action === "add_item") {
        newQty = (existingCartItem ? existingCartItem.quantity : 0) + quantity;
    } else if (action === "remove_item") {
        newQty = 0;
    }
    // For 'update_item', newQty is already set to 'quantity'

    // Ensure quantity is not negative
    newQty = Math.max(0, newQty);

    // --- 4. Stock Validation ---
    // Enforce stock check only if stockCount is a non-negative number
    if (typeof dish.stockCount === "number" && dish.stockCount !== -1) {
        if (newQty > dish.stockCount) {
            console.error("Stock validation failed:", { dishName: dish.name, newQty, available: dish.stockCount });
            const err = Object.assign({}, ErrorCode.NOT_ENOUGH_STOCK, {
                message: `Not enough stock for "${dish.name}". Available: ${dish.stockCount}`,
            });
            throw err;
        }
    }

    // --- 5. Perform Database Modifications (Now that validations passed) ---

    // Handle cases where no action is needed
    if (!cart && newQty === 0) {
        // No cart exists, and we are trying to remove/set qty to 0. Nothing to do.
        return { message: "Cart does not exist and quantity is zero." };
    }

    // Create cart *only if* it doesn't exist AND we are adding items
    if (!cart && newQty > 0) {
        cart = await Cart.create({ userId, storeId, mode: "private" });
    }

    // If after potential creation, we still don't have a cart (e.g., trying to remove from non-existent), exit.
    if (!cart) {
         return { message: "No cart found or created." }; // Should ideally not happen if newQty > 0
    }


    // Perform action on CartItem
    if (existingCartItem) {
        if (newQty === 0) {
            // Delete existing item and its toppings
            await CartItemTopping.deleteMany({
                cartItemId: existingCartItem._id,
            });
            await CartItem.deleteOne({ _id: existingCartItem._id });
        } else {
            // Update existing item
            existingCartItem.quantity = newQty;
            existingCartItem.note = note || existingCartItem.note; // Keep existing note if new one isn't provided
            // Recalculate price in case dish price changed (optional, depends on requirements)
            // existingCartItem.price = dish.price;
            await existingCartItem.save();

            // Rebuild toppings for the updated item
            await CartItemTopping.deleteMany({
                cartItemId: existingCartItem._id,
            });
            // Fetch topping details in bulk for efficiency
            const toppingDetails = await Topping.find({ _id: { $in: toppings }});
            const toppingMap = new Map(toppingDetails.map(t => [t._id.toString(), t]));

            for (const toppingId of toppings) {
                 const topping = toppingMap.get(toppingId.toString());
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
        // No existing item, create if newQty > 0
        if (newQty > 0) {
            const createdItem = await CartItem.create({
                cartId: cart._id,
                dishId: dish._id,
                dishName: dish.name,
                quantity: newQty,
                price: dish.price,
                participantId: userId, // Assuming private cart means user is participant
                note,
            });

            // Add toppings for the new item
            const toppingDetails = await Topping.find({ _id: { $in: toppings }});
            const toppingMap = new Map(toppingDetails.map(t => [t._id.toString(), t]));

            for (const toppingId of toppings) {
                 const topping = toppingMap.get(toppingId.toString());
                 if (topping) {
                    await CartItemTopping.create({
                        cartItemId: createdItem._id,
                        toppingId: topping._id,
                        toppingName: topping.name,
                        price: topping.price,
                    });
                }
            }
        }
        // If newQty is 0 and no existing item, nothing to do.
    }

    // --- 6. Clean up Empty Cart ---
    const remainingItemsCount = await CartItem.countDocuments({ cartId: cart._id });
    if (remainingItemsCount === 0) {
        await Cart.findByIdAndDelete(cart._id);
        console.log(`Cart ${cart._id} deleted as it became empty.`);
        // Optional: Emit cartDeleted event if needed
        return { message: "Cart updated and deleted as it became empty" };
    }

    // --- 7. Emit Socket Event ---
    try {
        const io = getIo(); // Assuming getIo() retrieves your socket.io instance
        // Assuming storeSockets maps storeId to an array of socketIds
        if (storeSockets && storeSockets[storeId]) {
            storeSockets[storeId].forEach((socketId) => {
                io.to(socketId).emit("cartUpdated", {
                    storeId,
                    userId,
                    cartId: cart._id,
                });
            });
        }
         if (userSockets && userSockets[userId]) { // Notify user too
            userSockets[userId].forEach((socketId) => {
                io.to(socketId).emit("cartUpdated", { // Use same event or a different one
                    storeId,
                    userId,
                    cartId: cart._id,
                });
            });
        }
    } catch (e) {
        console.error("Socket emission failed:", e);
        // Swallow socket errors, cart update was successful
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

    const cart = await Cart.findOne({ userId, storeId, completed: { $ne: true } });
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
    const saveCart = await cart.save();

    // notify store owner
    const store = await Store.findById(storeId);
    await Notification.create({
        userId: store.owner,
        orderId: newOrder._id,
        title: "New Order has been placed",
        message: "You have a new order!",
        type: "newOrder",
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
