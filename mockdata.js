const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("./config/db_connection");

// ===== Import Models =====
const Topping = require("./models/toppings.model");
const ToppingGroup = require("./models/topping_groups.model");
const DishToppingGroup = require("./models/dish_topping_groups.model");

// ====== Config ======
const storeId = new mongoose.Types.ObjectId("68dbedd99b4619555f222e11");
const dishIds = [
  new mongoose.Types.ObjectId("68ce8fd7d89d33e016701b98"),
  new mongoose.Types.ObjectId("68d8ec2d5bc7b0ea82666c17"),
];

// ====== Mock Data ======
const toppingGroupData = [
  {
    name: "Extra Cheese Options",
    onlyOnce: false,
    toppings: [
      { name: "Mozzarella", price: 10000 },
      { name: "Cheddar", price: 12000 },
      { name: "Parmesan", price: 15000 },
    ],
  },
  {
    name: "Sauce Choices",
    onlyOnce: true,
    toppings: [
      { name: "Spicy Mayo", price: 5000 },
      { name: "BBQ Sauce", price: 7000 },
      { name: "Garlic Butter", price: 8000 },
    ],
  },
  {
    name: "Add-ons",
    onlyOnce: false,
    toppings: [
      { name: "Bacon", price: 15000 },
      { name: "Grilled Chicken", price: 20000 },
      { name: "Shrimp", price: 25000 },
    ],
  },
];

(async () => {
  try {
    await connectDB();

    console.log("Clearing existing mock topping data for this store...");
    await ToppingGroup.deleteMany({ storeId });
    await Topping.deleteMany({}); // Optionally filter by groupIds if needed
    await DishToppingGroup.deleteMany({ dishId: { $in: dishIds } });

    console.log("Creating topping groups...");
    for (const group of toppingGroupData) {
      const toppingGroup = await ToppingGroup.create({
        name: group.name,
        storeId,
        onlyOnce: group.onlyOnce,
      });

      console.log(`Created ToppingGroup: ${group.name}`);

      // Create toppings for the group
      const createdToppings = await Topping.insertMany(
        group.toppings.map((t) => ({
          ...t,
          toppingGroupId: toppingGroup._id,
        }))
      );

      console.log(`  Added ${createdToppings.length} toppings to ${group.name}`);

      // Link this group to all dishes
      const dishLinks = dishIds.map((dishId) => ({
        dishId,
        toppingGroupId: toppingGroup._id,
      }));
      await DishToppingGroup.insertMany(dishLinks);
      console.log(`  Linked ${group.name} to ${dishIds.length} dishes.`);
    }

    console.log("✅ Mock topping data created successfully!");
  } catch (err) {
    console.error("❌ Error creating mock toppings:", err);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
})();
