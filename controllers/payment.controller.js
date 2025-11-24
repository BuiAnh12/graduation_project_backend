const createError = require("../utils/createError");
const {
  getQRCodeService,
  handleVnpReturnService,
  refundVNPayPaymentService,
} = require("../services/payment.service");
const ApiResponse = require("../utils/apiResponse")

const getQRCode = async (req, res, next) => {
  const { cartId } = req.params;
  try {
    const data = await getQRCodeService(cartId, req.body);
    return ApiResponse.success(res, data, "QR code fetch susccessully", 200);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const handleVnpReturn = async (req, res, next) => {
  try {
    const result = await handleVnpReturnService(req.query);
    return res.redirect(result.redirectUrl);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const refundVNPayPayment = async (req, res, next) => {
  const { transactionId, amount, orderId } = req.body;
  if (!transactionId || !amount) {
    return next(createError(400, "Missing refund transactionId or amount"));
  }

  try {
    const refundRecord = await refundVNPayPaymentService(transactionId, amount, orderId);
    res.status(200).json({ message: "Refund successful", data: refundRecord });
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

module.exports = { getQRCode, handleVnpReturn, refundVNPayPayment };
