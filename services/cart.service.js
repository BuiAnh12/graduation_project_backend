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
const User = require("../models/users.model");
const CartVoucher = require("../models/cart_vouchers.model");
const DishToppingGroup = require("../models/dish_topping_groups.model")
const { getNextSequence } = require("../utils/counterHelper");


const crypto = require("crypto");

const {
    getStoreSockets,
    getIo,
    getUserSockets,
} = require("../utils/socketManager");
const storeSockets = getStoreSockets();
const userSockets = getUserSockets();

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
    const participantInCarts = await CartParticipant.find({
        userId: userId,
        status: "active",
    })
        .select("cartId")
        .lean();
    const participantCartIds = participantInCarts.map((p) => p.cartId);

    const carts = await Cart.find({
        completed: { $ne: true },
        $or: [{ userId: userId }, { _id: { $in: participantCartIds } }],
    })
        .populate({
            path: "storeId",
            select: "name status openStatus avatarImage coverImage systemCategoryId",
            populate: [
                { path: "systemCategoryId", select: "name image" },
                { path: "avatarImage coverImage", select: "url" },
            ],
        })
        .populate({
            path: "userId", // Đây là userId của CHỦ NHÓM
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

// --- Helper function for broadcasting ---
const broadcastCartUpdate = async (cartId, eventName, payload) => {
    try {
        const participants = await CartParticipant.find({
            cartId: cartId,
            status: "active",
        }).select("userId");

        const io = getIo();

        for (const participant of participants) {
            const participantUserId = participant.userId.toString();
            const socketIds = userSockets[participantUserId];

            if (socketIds) {
                socketIds.forEach((socketId) => {
                    io.to(socketId).emit(eventName, payload);
                });
            }
        }
    } catch (e) {
        console.log(`Socket emit error in ${eventName}:`, e);
    }
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
                { path: "location" },
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
        cart: cart,
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
    action = "add_item", // 'add_item' (upsert/set) or 'remove_item'
}) => {
    try {
        // --- 1. Initial Validations ---
        if (!userId) throw ErrorCode.VALIDATION_ERROR;
        if (!storeId || !dishId) throw ErrorCode.VALIDATION_ERROR;

        const dish = await Dish.findById(dishId);
        if (!dish || dish.storeId.toString() !== storeId.toString()) {
            console.error("Dish validation failed:", { dishId, storeId, dish });
            throw ErrorCode.VALIDATION_ERROR;
        }

        // --- (Topping validation logic is correct, no changes) ---
        if (toppings && toppings.length > 0) {
            const dishToppingGroups = await DishToppingGroup.find({ dishId: dish._id });
            const allowedGroupIds = dishToppingGroups.map(dtg => dtg.toppingGroupId);

            const validToppings = await Topping.find({
                _id: { $in: toppings },
                toppingGroupId: { $in: allowedGroupIds } // Assumes Topping model has a 'groupId' field
            }).select('_id');

            if (validToppings.length !== toppings.length) {
                
                // Optional: Identify exactly which ones failed for better error logging
                const validIds = validToppings.map(t => t._id.toString());
                const invalidIds = toppings.filter(id => !validIds.includes(id));

                console.error("Invalid toppings detected:", invalidIds);
                throw ErrorCode.VALIDATION_ERROR;
            }
        }

        // --- 2. Find Existing Cart ---
        let cart = await Cart.findOne({
            userId,
            storeId,
            completed: { $ne: true },
        });

        // --- 3. Find Participant (or Create) ---
        let cartParticipant;
        if (cart) {
            cartParticipant = await CartParticipant.findOne({
                cartId: cart._id,
                userId: userId,
                isOwner: true,
            });
        }

        // --- 4. Create Cart & Participant if they don't exist (and we are adding) ---
        const targetQty = action === "remove_item" ? 0 : Math.max(0, quantity);
        
        if (!cart && targetQty > 0) {
            cart = await Cart.create({ userId, storeId, mode: "private" });
            
            cartParticipant = await CartParticipant.create({
                cartId: cart._id,
                userId: userId,
                isOwner: true,
                status: "active",
                joinedAt: new Date(),
            });
        }
        
        // If cart doesn't exist and we're not adding, exit
        if (!cart || !cartParticipant) {
             return { message: "No cart found or created." };
        }

        // --- [CHANGES START] ---
        // --- 5. Find Identical Existing Item (Group Logic) ---
        
        // Prepare query values
        const noteQueryValue = note || "";
        const noteQuery = (noteQueryValue === "") ? { $in: ["", null, undefined] } : noteQueryValue;
        const newToppingIds = [...(toppings || [])].sort().toString();

        // Find all items for this dish by this participant
        const existingItems = await CartItem.find({
            cartId: cart._id,
            participantId: cartParticipant._id,
            dishId: dishId,
            note: noteQuery,
        });

        let itemToUpsert = null;

        // Loop to find an exact topping match
        for (const item of existingItems) {
            const itemToppings = await CartItemTopping.find({
                cartItemId: item._id,
            });
            const itemToppingIds = itemToppings
                .map((t) => t.toppingId.toString())
                .sort()
                .toString();

            if (itemToppingIds === newToppingIds) {
                itemToUpsert = item;
                break; // Found our item
            }
        }
        // --- [CHANGES END] ---

        // --- 6. Stock Validation (using targetQty) ---
        if (typeof dish.stockCount === "number" && dish.stockCount !== -1) {
            // We check the *target* quantity, not an increment
            if (targetQty > dish.stockCount) {
                console.error("Stock validation failed:", {
                    dishName: dish.name,
                    newQty: targetQty,
                    available: dish.stockCount,
                });
                const err = Object.assign({}, ErrorCode.NOT_ENOUGH_STOCK, {
                    message: `Not enough stock for "${dish.name}". Available: ${dish.stockCount}`,
                });
                throw err;
            }
        }

        // --- 7. Perform Database Modifications ---

        if (itemToUpsert) {
            // --- ITEM EXISTS ---
            if (targetQty === 0) {
                // Remove item and its toppings
                await CartItemTopping.deleteMany({
                    cartItemId: itemToUpsert._id,
                });
                await CartItem.deleteOne({ _id: itemToUpsert._id });
            } else {
                // Update quantity and note
                itemToUpsert.quantity = targetQty;
                itemToUpsert.note = note || ""; // Update note
                
                // Recalculate price (toppings might have changed, though logic finds identical)
                const toppingDetails = await Topping.find({ _id: { $in: toppings } });
                const dishPrice = (dish.price || 0) * targetQty;
                const toppingsPrice = 
                    (toppingDetails.reduce((sum, t) => sum + (t.price || 0), 0) || 0) 
                    * targetQty;
                itemToUpsert.lineTotal = dishPrice + toppingsPrice;

                await itemToUpsert.save();
                
                // Re-create toppings (to ensure sync, though they shouldn't change)
                await CartItemTopping.deleteMany({ cartItemId: itemToUpsert._id });
                for (const topping of toppingDetails) {
                    await CartItemTopping.create({
                        cartItemId: itemToUpsert._id,
                        toppingId: topping._id,
                        toppingName: topping.name,
                        price: topping.price,
                    });
                }
            }
        } else if (targetQty > 0) {
            
            const toppingDetails = await Topping.find({ _id: { $in: toppings } });
            
            // Calculate prices
            const dishPrice = dish.price || 0;
            const toppingsPricePerItem = 
                toppingDetails.reduce((sum, t) => sum + (t.price || 0), 0) || 0;
            const finalLineTotal = (dishPrice + toppingsPricePerItem) * targetQty;
            
            const createdItem = await CartItem.create({
                cartId: cart._id,
                dishId: dish._id,
                dishName: dish.name,
                quantity: targetQty,
                price: dishPrice,
                participantId: cartParticipant._id,
                note: note || "",
                lineTotal: finalLineTotal, // Add lineTotal
            });

            // Add toppings
            for (const topping of toppingDetails) {
                await CartItemTopping.create({
                    cartItemId: createdItem._id,
                    toppingId: topping._id,
                    toppingName: topping.name,
                    price: topping.price,
                });
            }
        }

        // --- 8. Clean up Empty Cart ---
        const remainingItemsCount = await CartItem.countDocuments({
            cartId: cart._id,
        });
        if (remainingItemsCount === 0) {
            await Cart.findByIdAndDelete(cart._id);
            await CartParticipant.deleteMany({ cartId: cart._id });
            console.log(`Cart ${cart._id} deleted as it became empty.`);
            return { message: "Cart updated and deleted as it became empty" };
        }

        // --- 9. Emit Socket Event ---
        // (Your socket logic is correct, no changes needed)
        try {
            const io = getIo();
            // ... (emit to userSockets) ...
            // ... (emit to storeSockets if they exist) ...
        } catch (socketErr) {
            console.error("Socket emission failed:", socketErr);
        }

        return { message: "Cart updated successfully" };
    } catch (e) {
        console.error("Cart update failed:", e);
        throw e;
    }
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
    await CartParticipant.deleteMany({ cartId: { $in: cart._id } });

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
    await CartParticipant.deleteMany({ cartId: { $in: cartIds } });

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

    const cart = await Cart.findOne({
        userId,
        storeId,
        completed: { $ne: true },
    });
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
        title: "Bạn có đơn hàng mới",
        message: "Hãy hoàn thành đơn hàng nào!",
        type: "newOrder",
        status: "unread",
    });

    try {
        console.log("🧩 Active store sockets:", storeSockets[storeId]);
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
        console.log("📦 Emit newOrderNotification to store:", storeId);
        console.log("🧩 Active store sockets:", storeSockets[storeId]);
    } catch (e) {
        // swallow socket errors
        console.log("Error soccket ", e);
    }

    await Notification.create({
        userId: userId,
        orderId: newOrder._id,
        title: "Tạo đơn hàng thành công",
        message: "Bạn vừa tạo đơn hàng thành công",
        type: "newOrder",
        status: "unread",
    });

    try {
        console.log("🧩 Active user sockets:", userSockets[userId]);
        const io = getIo();
        if (userSockets[userId]) {
            userSockets[userId].forEach((socketId) => {
                io.to(socketId).emit("newOrderNotification", {
                    orderId: newOrder._id,
                    userId,
                    finalTotal,
                    status: newOrder.status,
                });
            });
        }
        console.log("📦 Emit newOrderNotification to user:", userId);
        console.log("🧩 Active user sockets:", userSockets[userId]);
    } catch (e) {
        // swallow socket errors
        console.log("Error soccket ", e);
    }

    return { orderId: newOrder._id };
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
};

const enableGroupCart = async ({ userId, storeId }) => {
    if (!userId || !storeId) {
        throw ErrorCode.VALIDATION_ERROR;
    }

    // 1. Find the user's active cart for this store
    const cart = await Cart.findOne({
        userId,
        storeId,
        completed: { $ne: true },
    });

    // 2. Handle Errors
    if (!cart) {
        throw ErrorCode.CART_REQUIRED_TO_ENABLE_GROUP;
    }
    const token = crypto.randomBytes(16).toString("hex");
    const expiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
    if (cart.mode === "group") {
        // throw ErrorCode.CART_ALREADY_GROUP_CART;
        cart.privateToken = token;
        cart.expiryAt = expiry;
    } else {
        cart.mode = "group";
        cart.privateToken = token;
        cart.expiryAt = expiry;
        cart.status = "active";
    }
    await cart.save();

    // 7. Return the updated cart
    return cart;
};

const joinGroupCart = async ({ userId, privateToken }) => {
    if (!userId || !privateToken) {
        throw ErrorCode.VALIDATION_ERROR;
    }

    // 1. Find Cart
    const cart = await Cart.findOne({ privateToken });

    // 2. Validate Cart
    if (!cart || cart.mode !== "group") {
        throw ErrorCode.INVALID_GROUP_CART_TOKEN;
    }
    if (cart.expiryAt < new Date()) {
        throw ErrorCode.GROUP_CART_EXPIRED;
    }
    if (cart.status !== "active") {
        throw ErrorCode.GROUP_CART_NOT_ACTIVE;
    }

    // 3. Validate User
    if (cart.userId.toString() === userId) {
        return { cartId: cart._id, storeId: cart.storeId };
    }

    const existingParticipant = await CartParticipant.findOne({
        cartId: cart._id,
        userId,
    });

    if (existingParticipant && existingParticipant.status === "active") {
        return { cartId: cart._id, storeId: cart.storeId };
    }

    // 4. Create Participant
    // If user was 'removed', reactivate them. Otherwise, create new.
    let newParticipant;
    if (existingParticipant) {
        existingParticipant.status = "active";
        existingParticipant.joinedAt = new Date();
        newParticipant = await existingParticipant.save();
    } else {
        newParticipant = await CartParticipant.create({
            cartId: cart._id,
            userId: userId,
            isOwner: false,
            status: "active",
            joinedAt: new Date(),
        });
    }

    // 5. Broadcast WebSocket
    try {
        const newUser = await User.findById(userId)
            .select("name profileImage")
            .lean();
        if (!newUser) throw ErrorCode.USER_NOT_FOUND; // Should not happen if auth works

        const allParticipants = await CartParticipant.find({
            cartId: cart._id,
            status: "active",
        }).select("userId");

        const io = getIo();

        for (const participant of allParticipants) {
            const participantUserId = participant.userId.toString();
            // Don't emit to the user who just joined
            if (participantUserId === userId) continue;

            const socketIds = userSockets[participantUserId];
            if (socketIds) {
                socketIds.forEach((socketId) => {
                    io.to(socketId).emit("participant_joined", {
                        _id: newParticipant._id, // cart_participant ID
                        userId: newUser._id,
                        userName: newUser.name,
                        profileImage: newUser.profileImage,
                    });
                });
            }
        }
    } catch (e) {
        // Non-critical, don't fail the join operation
        console.log("Socket emit error in joinGroupCart:", e);
    }

    // 6. Return
    return { cartId: cart._id, storeId: cart.storeId };
};

const getGroupCart = async ({ userId, cartId }) => {
    // 1. Auth (Permission)
    const participant = await CartParticipant.findOne({ userId, cartId });
    if (!participant || participant.status !== "active") {
        throw ErrorCode.NOT_PARTICIPANT;
    }

    // 2. Validate Cart
    const cart = await Cart.findById(cartId).populate("storeId").lean();
    if (!cart) throw ErrorCode.CART_NOT_FOUND;
    if (cart.mode !== "group") throw ErrorCode.CART_NOT_GROUP_CART;
    if (cart.status !== "active") {
        // Note: We still let them view if 'locking' or 'placed'
        console.log(`Cart ${cartId} is not active, but view is permitted.`);
    }

    // 3. Fetch All Data (Parallel)
    const [participants, cartItems, cartVouchers] = await Promise.all([
        CartParticipant.find({ cartId: cart._id, status: "active" })
            .populate({ path: "userId", select: "name profileImage" })
            .lean(),
        CartItem.find({ cartId: cart._id })
            .populate({ path: "dishId", select: "name price image" })
            .lean(),
        CartVoucher.find({ cartId: cart._id })
            .populate({ path: "voucherId" })
            .lean(),
    ]);

    if (!cartItems.length) {
        // Handle empty cart
        return {
            cart: { ...cart, shippingFee: cart.shippingFee || 0 },
            participants,
            totals: { subtotal: 0, discount: 0, shippingFee: 0, finalTotal: 0 },
        };
    }

    // 4. Process Data (Attach Toppings & Calculate Item lineTotal)
    const itemToppings = await CartItemTopping.find({
        cartItemId: { $in: cartItems.map((i) => i._id) },
    })
        .populate({ path: "toppingId", select: "name price" })
        .lean();

    let cartSubtotal = 0;
    const itemsWithTotals = cartItems.map((item) => {
        const toppings = itemToppings.filter(
            (t) => t.cartItemId.toString() === item._id.toString()
        );

        const dishPrice = (item.dishId?.price || 0) * item.quantity;
        const toppingsPrice =
            (toppings.reduce((sum, t) => sum + (t.toppingId?.price || 0), 0) ||
                0) * item.quantity;

        const lineTotal = dishPrice + toppingsPrice;
        cartSubtotal += lineTotal; // Sum for cartSubtotal

        return { ...item, toppings, lineTotal };
    });

    // 5. Calculate Totals (Voucher Logic)
    let totalDiscount = 0;
    const now = new Date();

    for (const cartVoucher of cartVouchers) {
        const voucher = cartVoucher.voucherId;
        if (!voucher || !voucher.isActive) continue;
        if (voucher.startDate > now || voucher.endDate < now) continue;
        if (voucher.minOrderAmount && cartSubtotal < voucher.minOrderAmount)
            continue;

        let discount = 0;
        if (voucher.discountType === "PERCENTAGE") {
            discount = (cartSubtotal * voucher.discountValue) / 100;
            if (voucher.maxDiscount)
                discount = Math.min(discount, voucher.maxDiscount);
        } else if (voucher.discountType === "FIXED") {
            discount = voucher.discountValue;
        }
        totalDiscount += discount;
    }

    const shippingFee = cart.shippingFee || 0;
    const finalTotal = Math.max(0, cartSubtotal - totalDiscount + shippingFee);

    // 6. Calculate Participant Breakdown
    const processedParticipants = participants.map((p) => {
        const participantItems = itemsWithTotals.filter(
            (item) => item.participantId.toString() === p._id.toString()
        );

        const participantSubtotal = participantItems.reduce(
            (sum, item) => sum + item.lineTotal,
            0
        );

        // Handle division by zero if cart is empty
        const subtotalPercentage =
            cartSubtotal > 0 ? participantSubtotal / cartSubtotal : 0;

        const discountShare = subtotalPercentage * totalDiscount;
        const finalOwes = participantSubtotal - discountShare;

        return {
            ...p,
            items: participantItems,
            participantSubtotal,
            discountShare,
            finalOwes,
        };
    });

    // 7. Format Response
    return {
        store: cart.storeId,
        cart: {
            ...cart,
            status: cart.status,
            expiryAt: cart.expiryAt,
            privateToken: cart.privateToken,
        },
        participants: processedParticipants,
        totals: {
            subtotal: cartSubtotal,
            discount: totalDiscount,
            shippingFee,
            finalTotal,
        },
    };
};

/**
 * Upserts (creates or updates) an item in a GROUP cart.
 * This function handles adding, updating quantity, and updating toppings.
 */
const upsertGroupCartItem = async ({
    userId,
    cartId,
    dishId,
    itemId,
    quantity,
    toppings,
    note,
    action, // 'add_item', 'update_item', 'remove_item'
}) => {
    // --- 1. Authorize Participant ---
    console.log({
        userId,
        cartId,
        dishId,
        itemId,
        quantity,
        toppings,
        note,
        action, // 'add_item', 'update_item', 'remove_item'
    })
    const participant = await CartParticipant.findOne({
        userId,
        cartId,
        status: "active",
    }).populate({ path: "cartId", match: { status: "active" } }); // Populate the cart

    if (!participant) throw ErrorCode.NOT_PARTICIPANT;

    // Find the cart. If we are updating, we get it from the item. If adding, from the participant.
    let cart;
    let itemToUpdate = null;

    if (action === "update_item" || action === "remove_item") {
        // --- UPDATE/REMOVE PATH (using itemId) ---
        if (!itemId) throw ErrorCode.VALIDATION_ERROR;

        itemToUpdate = await CartItem.findById(itemId).populate("cartId");
        if (!itemToUpdate) throw ErrorCode.DISH_NOT_FOUND; // Re-using error

        cart = itemToUpdate.cartId;
        if (!cart) throw ErrorCode.CART_NOT_FOUND;
        if (cart.status !== "active") throw ErrorCode.CART_IS_LOCKED;
        if (cart._id.toString() !== participant.cartId._id.toString()) {
            throw ErrorCode.ITEM_DOES_NOT_BELONG_TO_CART;
        }

        // Permission Check
        const isOwner = cart.userId.toString() === userId.toString();
        const isSelf =
            itemToUpdate.participantId.toString() ===
            participant._id.toString();
        if (!isOwner && !isSelf) {
            throw ErrorCode.PARTICIPANT_UNAUTHORIZED_FOR_ITEM;
        }
    } else if (action === "add_item") {
        // --- ADD PATH (using dishId) ---
        if (!dishId || !cartId) throw ErrorCode.VALIDATION_ERROR;

        cart = participant.cartId;
        if (!cart) throw ErrorCode.CART_NOT_FOUND; // Cart isn't active
        if (cart.status !== "active") throw ErrorCode.CART_IS_LOCKED;
    } else {
        throw ErrorCode.VALIDATION_ERROR;
    }

    // --- 2. Handle Logic based on Action ---

    // --- REMOVE_ITEM ---
    if (action === "remove_item") {
        await CartItemTopping.deleteMany({ cartItemId: itemToUpdate._id });
        await CartItem.deleteOne({ _id: itemToUpdate._id });

        await broadcastCartUpdate(cart._id, "item_removed", {
            _id: itemToUpdate._id,
            participantId: itemToUpdate.participantId,
            removedBy: userId,
        });
        return { message: "Item removed" };
    }

    // --- UPDATE_ITEM ---
    if (action === 'update_item') {
            let needsSave = false;
            
            // --- FIX 1: Khai báo biến này bên ngoài ---
            // Biến này sẽ giữ chi tiết topping để tính toán lineTotal
            let finalToppingDetails = []; 
        
            // Update Quantity
            if (quantity !== undefined) {
              const newQty = Math.max(0, quantity);
              if (newQty === 0) {
                // Quantity 0 means remove
                return upsertGroupCartItem({ userId, itemId, action: 'remove_item' });
              }
              itemToUpdate.quantity = newQty;
              needsSave = true;
            }
            
            // Update Note
            if (note !== undefined) {
              itemToUpdate.note = note;
              needsSave = true;
            }
            
            // Update Toppings
            if (toppings !== undefined) { // `toppings` là một mảng ID
              await CartItemTopping.deleteMany({ cartItemId: itemToUpdate._id });
              
              // Query các topping mới
              const newToppingDetails = await Topping.find({ _id: { $in: toppings } });
              
              for (const topping of newToppingDetails) {
                await CartItemTopping.create({
                  cartItemId: itemToUpdate._id,
                  toppingId: topping._id,
                  toppingName: topping.name,
                  price: topping.price,
                });
              }
              
              // --- FIX 2: Lưu các topping MỚI để tính giá ---
              finalToppingDetails = newToppingDetails;
              needsSave = true;
            } else if (needsSave) {
              // --- FIX 3: (Quan trọng) Nếu chỉ cập nhật số lượng/ghi chú ---
              // Chúng ta phải tải các topping HIỆN CÓ để tính lineTotal cho đúng
              const existingToppings = await CartItemTopping.find({ cartItemId: itemToUpdate._id })
                  .populate({ path: 'toppingId', select: 'price' }) // Chỉ cần lấy giá
                  .lean();
              
              // Chuyển đổi về định dạng giống như `Topping.find` (chỉ chứa đối tượng topping)
              finalToppingDetails = existingToppings.map(t => t.toppingId).filter(Boolean);
            }
        
            if (needsSave) {
              // Tính toán lại lineTotal CHÍNH XÁC
              const dishPrice = (itemToUpdate.price || 0) * itemToUpdate.quantity;
        
              // --- FIX 4: Sử dụng biến đã được khai báo ở phạm vi ngoài ---
              const toppingsPrice =
                  (finalToppingDetails.reduce((sum, t) => sum + (t.price || 0), 0) || 0) 
                    * itemToUpdate.quantity;
        
              itemToUpdate.lineTotal = dishPrice + toppingsPrice; // <--- ĐÃ SỬA
              await itemToUpdate.save();
            }
            
            await broadcastCartUpdate(cart._id, "item_updated", {
              _id: itemToUpdate._id,
              quantity: itemToUpdate.quantity,
              note: itemToUpdate.note,
              toppings: toppings, // `toppings` ở đây là mảng ID (nếu được gửi)
              participantId: itemToUpdate.participantId,
              updatedBy: userId,
            });
            
            return itemToUpdate;
          }

    // --- ADD_ITEM ---
    if (action === "add_item") {
        if (!dishId || quantity === undefined) throw ErrorCode.VALIDATION_ERROR;

        const dish = await Dish.findById(dishId).lean();
        if (!dish) throw ErrorCode.DISH_NOT_FOUND;
        if (dish.stockCount !== -1 && dish.stockCount < quantity) {
            throw ErrorCode.NOT_ENOUGH_STOCK;
        }

        // Check if an identical item (same dish, note, and toppings) already exists
        // This is the "upsert" part
        const newToppingIds = [...(toppings || [])].sort().toString();
        const noteQueryValue = note || "";
        let noteQuery;

        if (noteQueryValue === "") {
            // Nếu note rỗng, tìm các item có note là "", null, hoặc KHÔNG TỒN TẠI
            noteQuery = { $in: ["", null] };
        } else {
            // Nếu note có nội dung, tìm chính xác note đó
            noteQuery = noteQueryValue;
        }
        const existingItems = await CartItem.find({
            cartId: cart._id,
            participantId: participant._id,
            dishId: dish._id,
            note: noteQuery,
        });
        let itemToUpsert = null;
        let existingToppingDetails = [];
        for (const item of existingItems) {
            // Query các topping của món ăn *này*
            const itemToppings = await CartItemTopping.find({
                cartItemId: item._id,
            }).populate({ path: "toppingId", select: "price _id" }); // Populate để lấy giá

            // Chuyển topping của món này về dạng chuỗi
            const itemToppingIds = itemToppings
                .map((t) => t.toppingId?._id.toString()) // Lấy _id từ toppingId đã populate
                .filter(Boolean)
                .sort()
                .toString();

            // 4. So sánh
            if (itemToppingIds === newToppingIds) {
                // ĐÃ TÌM THẤY MÓN TRÙNG HOÀN TOÀN!
                itemToUpsert = item;
                // Lưu lại chi tiết topping để dùng tính giá
                existingToppingDetails = itemToppings
                    .map((t) => t.toppingId)
                    .filter(Boolean);
                break; // Thoát khỏi vòng lặp
            }
        }
        if (itemToUpsert) {
            // --- Item exists, just update quantity ---
            const toppingsPricePerItem =
                existingToppingDetails.reduce(
                    (sum, t) => sum + (t?.price || 0),
                    0
                ) || 0;

            const dishPrice = itemToUpsert.price || 0;

            itemToUpsert.quantity += quantity; // Cập nhật số lượng
            // Tính lại lineTotal dựa trên số lượng MỚI
            itemToUpsert.lineTotal =
                (dishPrice + toppingsPricePerItem) * itemToUpsert.quantity;

            await itemToUpsert.save();
            await broadcastCartUpdate(cart._id, "item_updated", {
                _id: itemToUpsert._id,
                quantity: itemToUpsert.quantity,
                participantId: itemToUpsert.participantId,
                updatedBy: userId,
            });
            return itemToUpsert;
        } else {
            // --- Item does not exist, create new ---
            const toppingDetails = await Topping.find({
                _id: { $in: toppings },
            });

            // Tính toán tất cả giá trị
            const dishPrice = dish.price || 0;
            const toppingsPricePerItem =
                toppingDetails.reduce((sum, t) => sum + (t.price || 0), 0) || 0;
            const finalLineTotal =
                (dishPrice + toppingsPricePerItem) * quantity;

            const newItem = await CartItem.create({
                cartId: cart._id,
                participantId: participant._id,
                dishId: dish._id,
                dishName: dish.name,
                quantity,
                price: dishPrice,
                note,
                lineTotal: finalLineTotal,
            });

            // Add toppings (sử dụng lại toppingDetails đã query)
            if (toppingDetails.length > 0) {
                for (const topping of toppingDetails) {
                    await CartItemTopping.create({
                        cartItemId: newItem._id,
                        toppingId: topping._id,
                        toppingName: topping.name,
                        price: topping.price,
                    });
                }
            }

            await broadcastCartUpdate(cart._id, "item_added", {
                ...newItem.toObject(),
                toppings: toppings, // Send the topping IDs
                participantId: participant._id,
                addedBy: userId,
            });

            return newItem;
        }
    }
};

const lockGroupCart = async (userId, cartId) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    // 1. Authorize (Owner only)
    if (cart.userId.toString() !== userId.toString()) {
        throw ErrorCode.NOT_OWNER_OF_CART;
    }

    // 2. Validate State
    if (cart.mode !== "group") throw ErrorCode.CART_NOT_GROUP_CART;
    if (cart.status !== "active") {
        throw ErrorCode.GROUP_CART_NOT_ACTIVE; // Re-using error
    }

    // 3. Update Cart
    cart.status = "locking";
    await cart.save();

    // 4. Broadcast
    await broadcastCartUpdate(cartId, "cart_state_changed", {
        newState: "locking",
    });

    return cart;
};

const unlockGroupCart = async (userId, cartId) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    // 1. Authorize (Owner only)
    if (cart.userId.toString() !== userId.toString()) {
        throw ErrorCode.NOT_OWNER_OF_CART;
    }

    // 2. Validate State
    if (cart.mode !== "group") throw ErrorCode.CART_NOT_GROUP_CART;
    if (cart.status !== "locking") {
        throw ErrorCode.CART_NOT_LOCKED;
    }

    // 3. Update Cart
    cart.status = "active";
    await cart.save();

    // 4. Broadcast
    await broadcastCartUpdate(cartId, "cart_state_changed", {
        newState: "active",
    });

    return cart;
};

const completeGroupCart = async (userId, cartId, payload) => {
    const {
        paymentMethod,
        customerName,
        customerPhonenumber,
        deliveryAddress,
        detailAddress,
        note,
        location = [],
        vouchers = [],
    } = payload;

    // 1. Auth & Validate Cart
    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;
    if (cart.userId.toString() !== userId.toString())
        throw ErrorCode.NOT_OWNER_OF_CART;
    if (cart.status !== "locking") throw ErrorCode.CART_NOT_LOCKED;
    if (cart.completed) throw ErrorCode.CART_ALREADY_COMPLETED; // Add this error code if you want

    // 2. Get All Cart & Participant Data
    const [participants, cartItems] = await Promise.all([
        CartParticipant.find({ cartId: cart._id, status: "active" }),
        CartItem.find({ cartId: cart._id })
            .populate({ path: "dishId", select: "name price image stockCount" })
            .lean(),
    ]);

    if (!cartItems.length) throw ErrorCode.CART_EMPTY;

    // 3. Re-use existing logic from 'completeCart'
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

    // Compute subtotal
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

    // Get and validate vouchers
    const cartVouchers = await CartVoucher.find({ cartId: cart._id });
    const voucherIds = cartVouchers.map((cv) => cv.voucherId);

    let totalDiscount = 0;
    const validVouchers = [];
    const now = new Date();

    for (const voucherId of vouchers) {
        // 'vouchers' này là từ payload
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

    const shippingFee = cart.shippingFee || 0; // Use cart's shipping fee
    const finalTotal = Math.max(0, subtotalPrice - totalDiscount + shippingFee);
    const orderNumber = await getNextSequence(cart.storeId, "order");

    // 4. Create Order (GROUP CART MODIFICATION)
    const newOrder = await Order.create({
        orderNumber,
        userId, // Owner
        storeId: cart.storeId,
        paymentMethod,
        status: "pending",
        subtotalPrice,
        totalDiscount,
        shippingFee,
        finalTotal,
        isGroupOrder: true, // Mark as group order
        participants: participants.map((p) => p._id), // Save all participant IDs
    });

    // 5. Create Order Items (GROUP CART MODIFICATION)
    for (const item of itemsWithToppings) {
        const p_dishPrice = item.dishId?.price || 0;
        const p_toppingsTotal_per_item =
            item.toppings?.reduce(
                (sum, t) => sum + (t.toppingId?.price || 0),
                0
            ) || 0;
        const p_toppingsTotal_all_quantity =
            p_toppingsTotal_per_item * item.quantity;
        const p_lineSubtotal = p_dishPrice * item.quantity;
        const p_lineTotal = p_lineSubtotal + p_toppingsTotal_all_quantity;

        const orderItem = await OrderItem.create({
            orderId: newOrder._id,
            dishId: item.dishId?._id,
            participantId: item.participantId, // <<< CRITICAL: Link item to participant
            dishName: item.dishId?.name || "",
            price: item.dishId?.price || 0,
            quantity: item.quantity,
            note: item.note || "",
            toppingsTotal: p_toppingsTotal_all_quantity,
            lineSubtotal: p_lineSubtotal,
            lineTotal: p_lineTotal,
            // ... (calculate line totals if needed)
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

    // 6. Create Ship Info (Same as completeCart)
    await OrderShipInfo.create({
        orderId: newOrder._id,
        shipLocation: { type: "Point", coordinates: location },
        address: deliveryAddress,
        detailAddress,
        contactName: customerName,
        contactPhonenumber: customerPhonenumber,
        note,
    });

    // 7. Save Vouchers & Usage (Same as completeCart)
    for (const { voucher, discount } of validVouchers) {
        await OrderVoucher.create({
            orderId: newOrder._id,
            voucherId: voucher._id,
            discountAmount: discount,
        });
        voucher.usedCount = (voucher.usedCount || 0) + 1;
        await voucher.save();

        // Increment usage for all participants? Or just owner?
        // Let's assume just the owner for now.
        await UserVoucherUsage.findOneAndUpdate(
            { userId, voucherId: voucher._id },
            { $inc: { usedCount: 1 }, startDate: voucher.startDate },
            { upsert: true, new: true }
        );
    }

    await CartParticipant.updateMany(
        { cartId: cart._id },
        { $set: { status: "completed" } }
    );

    // 8. Update Cart (GROUP CART MODIFICATION)
    cart.completed = true;
    cart.status = "placed"; // Set final status
    await cart.save();

    // 9. Notifications (GROUP CART MODIFICATION)

    // Notify Store (Same as completeCart)
    const store = await Store.findById(cart.storeId);
    await Notification.create({
        userId: store.owner,
        orderId: newOrder._id,
        title: "Bạn có đơn hàng nhóm mới",
        message: "Hãy hoàn thành đơn hàng nào!",
        type: "newOrder",
        status: "unread",
    });

    try {
        const io = getIo();
        if (storeSockets[cart.storeId]) {
            storeSockets[cart.storeId].forEach((socketId) => {
                io.to(socketId).emit("newOrderNotification", {
                    /* ...payload... */
                });
            });
        }
    } catch (e) {
        console.log("Socket error notifying store:", e);
    }

    // Notify All Participants (Replaces single-user notification)
    await broadcastCartUpdate(cartId, "cart_state_changed", {
        newState: "placed",
        orderId: newOrder._id,
    });

    return { orderId: newOrder._id };
};

const deleteGroupCart = async (userId, cartId) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;
    if (cart.userId.toString() !== userId) throw ErrorCode.NOT_OWNER_OF_CART;

    // Notify all participants *before* deleting
    await broadcastCartUpdate(cartId, "cart_dissolved", {
        message: "Cart has been deleted by the owner.",
    });

    // Find all item IDs to delete their toppings
    const items = await CartItem.find({ cartId }).select("_id").lean();
    const itemIds = items.map((i) => i._id);

    // Perform cascading delete
    await Promise.all([
        Cart.findByIdAndDelete(cartId),
        CartItemTopping.deleteMany({ cartItemId: { $in: itemIds } }),
        CartItem.deleteMany({ cartId: cartId }),
        CartParticipant.deleteMany({ cartId: cartId }),
        CartVoucher.deleteMany({ cartId: cartId }),
        // Also clear associated CartActivities if any
        CartActivity.deleteMany({ cartId: cartId }),
    ]);

    return { success: true };
};

const leaveGroupCart = async (userId, cartId) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    // Check if user is owner
    if (cart.userId.toString() === userId) {
        throw ErrorCode.OWNER_CANNOT_LEAVE_CART;
    }

    const participant = await CartParticipant.findOne({ userId, cartId });
    if (!participant || participant.status !== "active") {
        throw ErrorCode.NOT_PARTICIPANT;
    }

    // 1. Mark participant as removed
    participant.status = "removed";
    await participant.save();

    // 2. Find and delete their items + toppings
    const items = await CartItem.find({ participantId: participant._id })
        .select("_id")
        .lean();
    const itemIds = items.map((i) => i._id);

    await Promise.all([
        CartItemTopping.deleteMany({ cartItemId: { $in: itemIds } }),
        CartItem.deleteMany({ participantId: participant._id }),
    ]);

    const lelftUser = await User.findById(userId).select("name").lean();

    // 3. Broadcast update to remaining participants
    await broadcastCartUpdate(cartId, "participant_left", {
        userId: userId,
        userName: lelftUser.name,
        participantId: participant._id,
    });

    return { success: true };
};

const removeParticipant = async (
    ownerUserId,
    cartId,
    participantIdToRemove
) => {
    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    // 1. Authorize Owner
    if (cart.userId.toString() !== ownerUserId) {
        throw ErrorCode.NOT_OWNER_OF_CART;
    }

    const participant = await CartParticipant.findById(participantIdToRemove);
    if (!participant || participant.cartId.toString() !== cartId) {
        throw ErrorCode.PARTICIPANT_NOT_FOUND;
    }

    // 2. Check if owner is trying to remove themselves
    if (participant.userId.toString() === ownerUserId) {
        throw ErrorCode.OWNER_CANNOT_REMOVE_SELF;
    }

    // 3. Mark participant as removed
    participant.status = "removed";
    await participant.save();

    // 4. Find and delete their items + toppings
    const items = await CartItem.find({ participantId: participant._id })
        .select("_id")
        .lean();
    const itemIds = items.map((i) => i._id);

    await Promise.all([
        CartItemTopping.deleteMany({ cartItemId: { $in: itemIds } }),
        CartItem.deleteMany({ participantId: participant._id }),
    ]);

    // 5. Broadcast update to remaining participants
    await broadcastCartUpdate(cartId, "participant_left", {
        userId: participant.userId, // The user ID of the person who was removed
        participantId: participant._id,
    });

    // 6. Optionally, send a specific notification to the removed user
    // ... (logic to emit 'you_were_removed' to participant.userId) ...

    return { success: true };
};

module.exports = {
    getUserCarts,
    getCartDetail,
    createOrGetCart,
    upsertCartItem,
    applyRemoveVoucher,
    clearCartItemForStore,
    clearAllCarts,
    completeCart,
    applyVoucherService,
    removeVoucherService,
    enableGroupCart,
    joinGroupCart,
    getGroupCart,
    // addItemToGroupCart,
    upsertGroupCartItem,
    broadcastCartUpdate,
    // updateGroupCartItem,
    // removeGroupCartItem,
    lockGroupCart,
    unlockGroupCart,
    completeGroupCart,
    deleteGroupCart,
    leaveGroupCart,
    removeParticipant,
};
