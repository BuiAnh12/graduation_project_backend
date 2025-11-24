const ErrorCode = require("../constants/errorCodes.enum");
const CartItem = require("../models/cart_items.model");
const CartItemTopping = require("../models/cart_item_toppings.model");
const CartVoucher = require("../models/cart_vouchers.model");
const Cart = require("../models/carts.model");
const Location = require("../models/locations.model");
const Voucher = require("../models/vouchers.model");
const Order = require("../models/orders.model");
const Payment = require("../models/payments.model");
const Invoice = require("../models/invoices.model");
const convertCartToOrder = require("../utils/convertCartToOrder");
const { VNPay, ignoreLogger, VnpLocale, dateFormat } = require("vnpay");
const getNextSequence = require("../utils/counterHelper");

const getQRCodeService = async (cartId, body) => {
    const {
        userId,
        paymentMethod,
        customerName,
        customerPhonenumber,
        deliveryAddress,
        detailAddress,
        note,
        location = [],
        shippingFee = 0,
        vouchers = [], // Array of Voucher IDs from Body
    } = body;

    const cart = await Cart.findById(cartId);
    if (!cart) throw ErrorCode.CART_NOT_FOUND;

    // --- 1. Validation based on Cart Type ---
    // (Keep your existing validation logic)
    const isGroupCart = cart.status === "locking" || cart.status === "active"; // Simplified check
    if (isGroupCart) {
        if (cart.status !== "locking") throw ErrorCode.CART_NOT_LOCKED;
        if (cart.userId.toString() !== userId.toString())
            throw ErrorCode.NOT_OWNER_OF_CART;
    } else {
        if (cart.completed) throw ErrorCode.CART_ALREADY_COMPLETED;
    }

    // --- 2. Save Checkout State to DB ---
    const locationObject = await Location.create({
        userId,
        name: customerName,
        detailAddress,
        location: { type: "Point", coordinates: location },
        address: deliveryAddress,
        contactPhonenumber: customerPhonenumber,
        contactName: customerName,
        note,
    });

    cart.location = locationObject._id;
    cart.paymentMethod = paymentMethod;
    cart.shippingFee = shippingFee;
    cart.voucher = vouchers;
    await cart.save();

    // --- 3. Calculate Total for VNPay (FIXED) ---

    // STEP A: Fetch Items with LEAN()
    const cartItems = await CartItem.find({ cartId: cart._id })
        .populate("dishId") // Corrected from "dishes" to "dishId"
        .lean(); // Critical: Returns plain JS objects

    if (!cartItems.length) throw ErrorCode.CART_EMPTY;

    // STEP B: Fetch Toppings with LEAN()
    const itemToppings = await CartItemTopping.find({
        cartItemId: { $in: cartItems.map((i) => i._id) },
    })
        .populate({ path: "toppingId", select: "name price" })
        .lean();

    // STEP C: Merge (Clean Plain Objects)
    const itemsWithToppings = cartItems.map((item) => {
        const toppings = itemToppings.filter(
            (t) => t.cartItemId.toString() === item._id.toString()
        );
        return { ...item, toppings };
    });

    // STEP D: Calculate Subtotal
    let subtotalPrice = 0;
    for (const item of itemsWithToppings) {
        // 1. Dish Price
        const dishPrice = (item.dishId?.price || 0) * item.quantity;

        // 2. Topping Price
        // Note: t.toppingId.price because we populated toppingId
        const toppingsPrice =
            (item.toppings?.reduce(
                (sum, t) => sum + (t.toppingId?.price || 0),
                0
            ) || 0) * item.quantity;

        subtotalPrice += dishPrice + toppingsPrice;
    }

    // STEP E: Vouchers
    let totalDiscount = 0;
    const now = new Date();

    // Use the 'vouchers' array passed from the body
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
    }

    // Final Total Check
    const finalTotal = Math.max(0, subtotalPrice - totalDiscount + shippingFee);

    console.log(
        `💰 Subtotal: ${subtotalPrice}, Discount: ${totalDiscount}, Ship: ${shippingFee}`
    );
    console.log(`✅ Final Total for VNPay: ${finalTotal}`);

    // --- 4. Generate URL ---
    const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString();
    const txnRef = cartId + "_" + randomSuffix;

    const vnpay = new VNPay({
        tmnCode: process.env.VNPAY_TMN_CODE,
        secureSecret: process.env.VNPAY_SECRET_KEY,
        vnpayHost: process.env.VNPAY_PAYMENT_URL,
        testMode: true,
        hashAlgorithm: "SHA512",
        loggerFn: ignoreLogger,
    });

    const paymentParams = {
        vnp_Amount: finalTotal, // VNPay expects amount in normal currency (SDK handles *100 if needed, check SDK docs)
        vnp_IpAddr: "127.0.0.1",
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: `Thanh toan don hang ${cartId}`,
        vnp_ReturnUrl: process.env.VNPAY_RETURN_CHECK_PAYMENT,
        vnp_Locale: VnpLocale.VN,
        vnp_CreateDate: dateFormat(new Date()),
        vnp_ExpireDate: dateFormat(new Date(Date.now() + 15 * 60 * 1000)),
    };

    return await vnpay.buildPaymentUrl(paymentParams);
};
const handleVnpReturnService = async (query) => {
    const vnpay = new VNPay({ secureSecret: process.env.VNPAY_SECRET_KEY });
    const isValid = await vnpay.verifyReturnUrl(query);
    if (!isValid) throw ErrorCode.INVALID_SIGNATURE;

    const { vnp_TxnRef, vnp_ResponseCode, vnp_TransactionNo } = query;

    // Split txnRef to get ID (since we added suffix)
    const cartId = vnp_TxnRef.split("_")[0];

    const currentCart = await Cart.findById(cartId);
    if (!currentCart) throw ErrorCode.CART_NOT_FOUND;

    // 1. Handle Failure
    if (vnp_ResponseCode !== "00") {
        return {
            success: false,
            redirectUrl: `http://localhost:3000/store/${currentCart.storeId}/cart?status=${vnp_ResponseCode}`,
        };
    }

    // 2. Convert to Order (Unified Logic)
    const result = await convertCartToOrder(cartId);

    if (!result.success) {
        // Payment successful on VNPay side, but Order creation failed (Critical!)
        // TODO: Log this heavily and potentially initiate a refund or manual fix
        console.error(
            "CRITICAL: Payment Success but Order Creation Failed",
            result
        );
        return {
            success: false,
            redirectUrl: `http://localhost:3000/store/${currentCart.storeId}/cart?error=order_creation_failed`,
        };
    }

    const orderId = result.orderId;

    // 3. Record Payment
    const existingPayment = await Payment.findOne({
        transactionId: vnp_TxnRef,
    });
    if (!existingPayment) {
        await Payment.create({
            orderId: orderId,
            provider: "vnpay",
            amount: result.totalPrice,
            status: "success",
            transactionId: vnp_TxnRef,
            metadata: query,
        });
    }

    // 4. Update Order Payment Status
    await Order.findByIdAndUpdate(orderId, { paymentStatus: "paid" });

    // 5. Create Invoice (Optional, kept from your code)
    // ... invoice logic ...

    return {
        success: true,
        redirectUrl: `http://localhost:3000/orders/detail-order/${orderId}?status=success`,
    };
};

const refundVNPayPaymentService = async (transactionId, amount, orderId) => {
    const vnpay = new VNPay({
        tmnCode: process.env.VNPAY_TMN_CODE,
        secureSecret: process.env.VNPAY_SECRET_KEY,
        vnpayHost: process.env.VNPAY_PAYMENT_URL,
        hashAlgorithm: "SHA512",
        loggerFn: ignoreLogger,
    });

    const refundParams = {
        vnp_TxnRef: transactionId,
        vnp_Amount: amount,
        vnp_TransactionType: "02",
        vnp_RequestId: Date.now().toString(),
        vnp_OrderInfo: `Refund order ${orderId || ""}`,
        vnp_TransactionDate: dateFormat(new Date()),
    };

    const response = await vnpay.refund(refundParams);
    if (response.vnp_ResponseCode !== "00") {
        throw createError(
            400,
            `Refund failed: ${response.vnp_Message || "Unknown"}`
        );
    }

    return await Payment.create({
        orderId: orderId || null,
        provider: "vnpay",
        amount,
        status: "refunded",
        transactionId: transactionId + "_refund_" + Date.now(),
        metadata: response,
    });
};

module.exports = {
    getQRCodeService,
    handleVnpReturnService,
    refundVNPayPaymentService,
};
