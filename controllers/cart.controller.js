// controllers/cart.controller.js
const ApiResponse = require("../utils/apiResponse");
const ErrorCode = require("../constants/errorCodes.enum");
const {
  getUserCarts,
  getCartDetail,
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
  // updateGroupCartItem,
  // removeGroupCartItem,
  upsertGroupCartItem,
  
  lockGroupCart,
  unlockGroupCart,
  completeGroupCart,
  deleteGroupCart,
  leaveGroupCart,
  removeParticipant
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

const enableGroupCartController = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);

    const { storeId } = req.body;
    if (!storeId) {
      return ApiResponse.error(res, ErrorCode.VALIDATION_ERROR, "storeId is required");
    }

    const cart = await enableGroupCart({ userId, storeId });
    
    return ApiResponse.success(
      res,
      cart,
      "Group cart enabled successfully",
      200
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const joinGroupCartController = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);

    const { privateToken } = req.params;
    if (!privateToken) {
      return ApiResponse.error(res, ErrorCode.VALIDATION_ERROR, "Token is required");
    }

    const result = await joinGroupCart({ userId, privateToken });
    
    return ApiResponse.success(
      res,
      result,
      "Joined group cart successfully"
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getGroupCartController = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);

    const { cartId } = req.params;
    if (!cartId) {
      return ApiResponse.error(res, ErrorCode.VALIDATION_ERROR, "cartId is required");
    }

    const result = await getGroupCart({ userId, cartId });
    
    return ApiResponse.success(
      res,
      result,
      "Group cart retrieved successfully"
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};


const upsertGroupCartItemController = async (req, res) => {
    try {
      const userId = req?.user?._id;
      if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);
      
      // Tất cả dữ liệu bây giờ đều nằm trong req.body
      const itemData = req.body; 
      
      const result = await upsertGroupCartItem({
        userId,
        cartId: itemData.cartId,
        dishId: itemData.dishId,
        itemId: itemData.itemId,
        quantity: itemData.quantity,
        toppings: itemData.toppings,
        note: itemData.note,
        action: itemData.action,
      });
      
      return ApiResponse.success(res, result, "Cập nhật giỏ hàng thành công", 200);
    } catch (err) {
      return ApiResponse.error(res, err);
    }
  };



const lockGroupCartController = async (req, res) => {
  try {
    const userId = req?.user?._id;
    console.log(userId)
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);
    
    const { cartId } = req.params;
    
    const cart = await lockGroupCart(userId, cartId);
    
    return ApiResponse.success(res, cart, "Cart locked successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const unlockGroupCartController = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);
    
    const { cartId } = req.params;
    
    const cart = await unlockGroupCart(userId, cartId);
    
    return ApiResponse.success(res, cart, "Cart unlocked successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const completeGroupCartController = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);
    
    const { cartId } = req.params;
    const payload = req.body; // { paymentMethod, customerName, ... }
    
    const result = await completeGroupCart(userId, cartId, payload);
    
    return ApiResponse.success(res, result, "Group order placed successfully", 201);
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const deleteGroupCartController = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);
    
    const { cartId } = req.params;
    
    const result = await deleteGroupCart(userId, cartId);
    
    return ApiResponse.success(res, result, "Group cart deleted successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const leaveGroupCartController = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);
    
    const { cartId } = req.params;
    
    const result = await leaveGroupCart(userId, cartId);
    
    return ApiResponse.success(res, result, "You have left the group cart");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const removeParticipantController = async (req, res) => {
  try {
    const userId = req?.user?._id; // This is the Owner
    if (!userId) return ApiResponse.error(res, ErrorCode.ACCESS_TOKEN_EXPIRED);
    
    const { cartId, participantId } = req.params;
    
    const result = await removeParticipant(userId, cartId, participantId);
    
    return ApiResponse.success(res, result, "Participant removed successfully");
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
  applyVoucher,
  removeVoucher,
  // Group Cart
  enableGroupCartController,
  joinGroupCartController,
  getGroupCartController,
  // addItemToGroupCartController,
  // updateGroupCartItemController,
  // removeGroupCartItemController,
  upsertGroupCartItemController,
  lockGroupCartController,
  unlockGroupCartController,
  completeGroupCartController,
  deleteGroupCartController,
  leaveGroupCartController,
  removeParticipantController,
};
