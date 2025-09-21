const { getUserCartService } = require("../services/cart.service");

const getUserCart = async (req, res) => {
  try {
    const userId = req?.user?._id;

    const carts = await getUserCartService(userId);

    if (!carts || carts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Carts not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: carts,
    });
  } catch (error) {
    console.error("getUserCart error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getUserCart,
};
