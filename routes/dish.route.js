const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
    getDishById,
    getDishesByStoreId,
    createDish,
    changeStatus,
    updateDish,
    deleteDish

} = require("../controllers/dish.controller");

const router = express.Router();

router.get("/:dish_id", getDishById);
// router.get("/store/:store_id", authMiddleware, roleAuthMiddleware(["owner", "staff", "manager" ]), getDishesByStoreId);
router.get("/store/:store_id", getDishesByStoreId);
// router.post("/store/:store_id", authMiddleware, roleAuthMiddleware(["owner", "manager"]), createDish); 
router.post("/store/:store_id", createDish); 



// router.put("/:dish_id", authMiddleware, roleAuthMiddleware(["owner", "manager"]), updateDish); 
router.put("/:dish_id", updateDish); 
// router.delete("/:dish_id", authMiddleware, roleAuthMiddleware(["owner", "manager"]), deleteDish);
router.delete("/:dish_id", deleteDish);

// router.post("/:dish_id/status", authMiddleware, roleAuthMiddleware(["owner", "staff", "manager"]), changeStatus);
router.post("/:dish_id/status", changeStatus);
module.exports = router;
