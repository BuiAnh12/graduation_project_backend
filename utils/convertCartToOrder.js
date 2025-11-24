const Cart = require("../models/carts.model");
const {
    completeCartInternal,
    completeGroupCartInternal,
} = require("./orderHelpers");
const { getNextSequence } = require("../utils/counterHelper");

const convertCartToOrder = async (cartId) => {
    const cart = await Cart.findById(cartId).populate("location");
    if (!cart) return { success: false, message: "Cart not found" };

    const isGroupOrder = cart.mode === "group";
    const isGroupOrderLock =
        cart.status === "locking" || cart.status === "placed";

    try {
        let result;
        if (isGroupOrder) {
            if (isGroupOrderLock) {
                // Call the Group Logic
                result = await completeGroupCartInternal(cart);
            }
        } else {
            // Call the Private Logic
            result = await completeCartInternal(cart);
        }

        return {
            success: true,
            orderId: result.orderId,
            totalPrice: result.finalTotal,
        };
    } catch (error) {
        console.error("Error converting cart to order:", error);
        return { success: false, message: error.message };
    }
};

module.exports = convertCartToOrder;
