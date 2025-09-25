// controllers/cart.controller.js
const ApiResponse = require("../utils/ApiResponse");
const ErrorCode = require("../constants/errorCodes.enum");
const {
  getUserCarts,
  getCartDetail,
  upsertCartItem,
  applyRemoveVoucher,
  clearCartItemForStore,
  clearAllCarts,
  completeCart,
  joinCartService,
  leaveCartService,
  applyVoucherService,
  removeVoucherService
} = require("../services/cart.service");

/**
 * GET / - get all carts for authenticated user
 */
const getUserCart = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);

    const carts = await getUserCarts(userId);
    return ApiResponse.success(res, carts, "Carts fetched");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

/**
 * GET /detail/:cartId
 */
const getDetailCart = async (req, res) => {
  try {
    const userId = req?.user?._id;
    const { cartId } = req.params;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);

    const data = await getCartDetail(userId, cartId);
    return ApiResponse.success(res, data, "Cart detail fetched");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

/**
 * POST /update
 * This endpoint supports multiple actions via body.action:
 * - create_cart (storeId)
 * - add_item / update_item / remove_item
 *    body: { storeId, dishId, quantity, toppings, note, action }
 * - apply_voucher / remove_voucher
 *    body: { storeId, voucherId, action }
 * - join_cart / leave_cart  (not fully implemented; placeholder)
 */
const updateCart = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);

    const {
      action = "add_item",
      storeId,
      dishId,
      quantity,
      toppings = [],
      note,
      voucherId,
    } = req.body;

    // handle action routing
    if (["add_item", "update_item", "remove_item"].includes(action)) {
      const result = await upsertCartItem({
        userId,
        storeId,
        dishId,
        quantity,
        toppings,
        note,
        action,
      });
      // result may contain message or info
      return ApiResponse.success(res, null, result.message || "Cart updated");
    }

    if (action === "apply_voucher" || action === "remove_voucher") {
      if (!voucherId) return ApiResponse.error(res, ErrorCode.VALIDATION_ERROR);
      const result = await applyRemoveVoucher({ userId, storeId, voucherId, action });
      return ApiResponse.success(res, null, result.message || "Voucher processed");
    }

    // create_cart (explicit)
    if (action === "create_cart") {
      const { createOrGetCart } = require("../services/cart.service");
      const cart = await createOrGetCart(userId, storeId);
      return ApiResponse.success(res, cart, "Cart created");
    }

    if (action === "join_cart" || action === "leave_cart") {
      // currently a placeholder: implement shared cart participant logic (cart_participants)
      return ApiResponse.success(res, null, `${action} is not implemented yet`);
    }

    return ApiResponse.error(res, ErrorCode.INVALID_KEY);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

/**
 * DELETE /clear/item/:storeId
 */
const clearCartItem = async (req, res) => {
  try {
    const userId = req?.user?._id;
    const { storeId } = req.params;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);

    const result = await clearCartItemForStore(userId, storeId);
    return ApiResponse.success(res, null, result.message || "Cart for store cleared");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

/**
 * DELETE /clear
 */
const clearCart = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);

    const result = await clearAllCarts(userId);
    return ApiResponse.success(res, null, result.message || "All carts cleared");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

/**
 * POST /complete
 * Body: { storeId, paymentMethod, customerName, customerPhonenumber, deliveryAddress,
 * detailAddress, note, location:[lng,lat], shippingFee, vouchers: [voucherId] }
 */
const completeCartController = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);

    const payload = req.body;
    payload.userId = userId;

    const result = await completeCart(payload);
    return ApiResponse.success(res, result, "Order placed successfully", 201);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const joinCart = async (req, res) => {
  try {
    const { cartId } = req.params;
    const participant = {
      userId: req.user?._id || null,
      participantName: req.body.participantName || null,
    };
    const data = await joinCartService(cartId, participant);
    return ApiResponse.success(res, data, "Joined cart successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const leaveCart = async (req, res) => {
  try {
    const { cartId, participantId } = req.params;
    const userId = req.user?._id || null;
    const data = await leaveCartService(cartId, participantId, userId);
    return ApiResponse.success(res, data, "Left cart successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const applyVoucher = async (req, res) => {
  try {
    const { cartId } = req.params;
    const { voucherCode } = req.body;
    const data = await applyVoucherService(cartId, voucherCode);
    return ApiResponse.success(res, data, "Voucher applied successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const removeVoucher = async (req, res) => {
  try {
    const { cartId } = req.params;
    const data = await removeVoucherService(cartId);
    return ApiResponse.success(res, data, "Voucher removed successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

module.exports = {
  getUserCart,
  getDetailCart,
  updateCart,
  clearCartItem,
  clearCart,
  completeCart: completeCartController,
  joinCart,
  leaveCart,
  applyVoucher,
  removeVoucher
};
