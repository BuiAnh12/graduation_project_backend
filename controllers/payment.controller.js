const asyncHandler = require("express-async-handler");
const createError = require("../utils/createError");
const {
  getQRCodeService,
  handleVnpReturnService,
  refundVNPayPaymentService,
} = require("../services/payment.service");

const getQRCode = asyncHandler(async (req, res, next) => {
  const { cartId } = req.params;
  try {
    const paymentUrl = await getQRCodeService(cartId, req.body);
    res.status(200).json({ paymentUrl });
  } catch (err) {
    next(err);
  }
});

const handleVnpReturn = asyncHandler(async (req, res, next) => {
  try {
    const result = await handleVnpReturnService(req.query);
    return res.redirect(result.redirectUrl);
  } catch (err) {
    next(err);
  }
});

const refundVNPayPayment = asyncHandler(async (req, res, next) => {
  const { transactionId, amount, orderId } = req.body;
  if (!transactionId || !amount) {
    return next(createError(400, "Missing refund transactionId or amount"));
  }

  try {
    const refundRecord = await refundVNPayPaymentService(transactionId, amount, orderId);
    res.status(200).json({ message: "Refund successful", data: refundRecord });
  } catch (err) {
    next(err);
  }
});

module.exports = { getQRCode, handleVnpReturn, refundVNPayPayment };
