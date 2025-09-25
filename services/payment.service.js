const ErrorCode = require("../constants/errorCodes.enum")
const CartItem = require("../models/cartItem.model");
const Cart = require("../models/cart.model");
const Location = require("../models/location.model");
const Voucher = require("../models/voucher.model");
const Order = require("../models/order.model");
const Payment = require("../models/payment.model");
const Invoice = require("../models/invoices.model");
const convertCartToOrder = require("../utils/convertCartToOrder");
const {
  VNPay,
  ignoreLogger,
  VnpLocale,
  dateFormat,
} = require("vnpay");

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
    vouchers = [],
  } = body;

  const cart = await Cart.findById(cartId);
  if (!cart) throw ErrorCode.CART_NOT_FOUND

  // Create new location
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

  const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString();
  const txnRef = cartId + randomSuffix;

  const cartItems = await CartItem.find({ cartId: cart._id })
    .populate("dish")
    .populate("toppings");
  if (!cartItems.length) throw ErrorCode.CART_EMPTY

  let subtotalPrice = 0;
  for (const item of cartItems) {
    const dishPrice = (item.dish?.price || 0) * item.quantity;
    const toppingsPrice =
      (Array.isArray(item.toppings)
        ? item.toppings.reduce((sum, topping) => sum + (topping.price || 0), 0)
        : 0) * item.quantity;
    subtotalPrice += dishPrice + toppingsPrice;
  }

  let totalDiscount = 0;
  const now = new Date();
  for (const voucherId of vouchers) {
    const voucher = await Voucher.findById(voucherId);
    if (!voucher || !voucher.isActive) continue;
    if (voucher.startDate > now || voucher.endDate < now) continue;
    if (voucher.minOrderAmount && subtotalPrice < voucher.minOrderAmount) continue;

    let discount = 0;
    if (voucher.discountType === "PERCENTAGE") {
      discount = (subtotalPrice * voucher.discountValue) / 100;
      if (voucher.maxDiscount) discount = Math.min(discount, voucher.maxDiscount);
    } else if (voucher.discountType === "FIXED") {
      discount = voucher.discountValue;
    }
    totalDiscount += discount;
  }

  const finalTotal = Math.max(0, subtotalPrice - totalDiscount + shippingFee);

  const vnpay = new VNPay({
    tmnCode: process.env.VNPAY_TMN_CODE,
    secureSecret: process.env.VNPAY_SECRET_KEY,
    vnpayHost: process.env.VNPAY_PAYMENT_URL,
    testMode: true,
    hashAlgorithm: "SHA512",
    loggerFn: ignoreLogger,
  });

  const paymentParams = {
    vnp_Amount: finalTotal,
    vnp_IpAddr: "127.0.0.1",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: `Payment for cart ${cart._id}`,
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
  if (!isValid) throw ErrorCode.INVALID_SIGNATURE

  const { vnp_TxnRef, vnp_ResponseCode } = query;
  const cartId = vnp_TxnRef.slice(0, 24);
  const currentCart = await Cart.findById(cartId);
  if (!currentCart) throw ErrorCode.CART_NOT_FOUND

  if (vnp_ResponseCode !== "00") {
    return { success: false, redirectUrl: `http://localhost:3001/store/${currentCart.storeId}/cart?status=${vnp_ResponseCode}` };
  }

  const result = await convertCartToOrder(cartId);
  if (!result.success) {
    return { success: false, redirectUrl: `http://localhost:3001/store/${currentCart.storeId}/cart` };
  }
  const order = result
  const successOrder = await Order.findById(orderId);
  successOrder.paymentStatus = "paid";
  await successOrder.save();

  const existingPayment = await Payment.findOne({ transactionId: vnp_TxnRef });
  if (!existingPayment) {
    await Payment.create({
      orderId: order._id,
      provider: "vnpay",
      amount: result.totalPrice,
      status: "success",
      transactionId: vnp_TxnRef,
      metadata: query,
    });
  } else {
    existingPayment.status = "success"
  }
  const seq = await getNextSequence(storeId, "invoice");
  const invoiceNumber = `INV-${Date.now()}-${seq}`; 
  const invoice = await Invoice.create({
    invoiceNumber,
    orderId: order._id,
    issuedAt: new Date(),
    subtotal: order.subtotalPrice,
    shippingFee: order.shippingFee,
    total: order.finalTotal,
    currency: "VND", // or from store settings
    status: "issued",
    orderSnapshot: order.toObject(), // snapshot the entire order at done time
  });

  return { success: true, redirectUrl: `http://localhost:3001/orders/detail-order/${order._id}?status=success` };
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
    throw createError(400, `Refund failed: ${response.vnp_Message || "Unknown"}`);
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
