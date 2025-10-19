const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeMiddleware = require("../middlewares/authorizeMiddleware");
const {
  getDishById,
  getDishesByStoreId,
  createDish,
  changeStatus,
  updateDish,
  deleteDish,
  getDetailDishByStore,
} = require("../controllers/dish.controller");

const router = express.Router();

// Lấy danh sách món ăn theo store
router.get("/store/:store_id", getDishesByStoreId);

// Tạo món ăn mới
router.post(
  "/store/:store_id",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  createDish
);

// Cập nhật món ăn
router.put(
  "/store/:store_id/dish/:dish_id",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  updateDish
);

// Xóa món ăn
router.delete(
  "/store/:store_id/dish/:dish_id",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  deleteDish
);

// Đổi trạng thái món ăn (VD: available/unavailable)
router.post(
  "/store/:store_id/dish/:dish_id/status",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER"],
  }),
  changeStatus
);

// Lấy chi tiết món ăn theo store (dành cho STAFF, OWNER, MANAGER)
router.get(
  "/store/:store_id/dish/:dish_id",
  authMiddleware,
  authorizeMiddleware({
    staff: ["STORE_OWNER", "MANAGER", "STAFF"],
  }),
  getDetailDishByStore
);

// Lấy món ăn theo ID chung (public)
router.get("/:dish_id", getDishById);

module.exports = router;
