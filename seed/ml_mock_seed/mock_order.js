const mongoose = require('mongoose');
const { Schema } = mongoose;
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";
const NUMBER_OF_ORDERS_PER_USER = 15; // Creates 15 orders for each of the 10 users


// Register Models
const User = require("../../models/users.model")
const Dish = require("../../models/dishes.model")
const Order = require("../../models/orders.model")
const OrderItem = require("../../models/order_items.model")
const Rating = require("../../models/ratings.model")

// --- Helper Functions ---

/**
 * Reads a CSV file and returns its parsed content.
 */
async function readCSV(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    const lines = data.trim().split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
            obj[header.trim()] = values[index] ? values[index].trim() : '';
            return obj;
        }, {});
    });
}

/**
 * Generates a random integer between min and max (inclusive).
 */
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// --- Main Seeder Script ---

async function seedInteractions() {
    try {
        // 1. Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log("🚀 MongoDB connected for seeding interactions...");

        // 2. Load Data from CSV Files
        console.log("🔄 Loading data from CSV files...");
        const users = await readCSV(path.join(__dirname, '../../exported_data/users.csv'));
        const dishes = await readCSV(path.join(__dirname, '../../exported_data/dishes.csv'));
        
        // Filter for only the 10 persona users
        const personaUsers = users.filter(u => u.preferences && u.preferences !== '{}');
        console.log(`✅ Loaded ${personaUsers.length} user personas and ${dishes.length} dishes.`);

        // 3. Clear existing interaction data for a clean run
        console.log("🗑️  Clearing previous mock interaction data...");
        await Order.deleteMany({});
        await OrderItem.deleteMany({});
        await Rating.deleteMany({});
        console.log("✅ Previous data cleared.");

        // 4. Define Persona-Dish Mapping
        const personaDishMap = {
            'Health Conscious': ['Gỏi Cuốn Tôm', 'Sushi Salmon Roll', 'Phở Bò'],
            'Adventure Seeker': ['Tom Yum Goong', 'Korean BBQ Bulgogi', 'Pad Thai Fusion'],
            'Comfort Food Lover': ['Cơm Tấm Sườn Nướng', 'Bún Chả Hà Nội', 'Mapo Tofu', 'Kung Pao Chicken'],
            'Traditional Eater': ['Phở Bò', 'Bún Chả Hà Nội', 'Cơm Tấm Sườn Nướng', 'Canh Chua Cá Lóc'],
            'Trendy Foodie': ['Sushi Salmon Roll', 'Ramen Tonkotsu', 'Bibimbap Bowl'],
            'Spice Lover': ['Tom Yum Goong', 'Butter Chicken Curry', 'Kung Pao Chicken'],
            'Quick Eater': ['Bánh Mì Thịt Nướng', 'Pad Thai Fusion', 'Bibimbap Bowl'],
            'Balanced Eater': ['Bibimbap Bowl', 'Sushi Salmon Roll', 'Gỏi Cuốn Tôm'],
            'Conservative Eater': ['Phở Bò', 'Cơm Tấm Sườn Nướng', 'Bánh Mì Thịt Nướng'],
            'Sweet Tooth': ['Mango Sticky Rice', 'Chè Đậu Đỏ', 'Nem Nướng Nha Trang']
        };

        const newOrders = [];
        const newOrderItems = [];
        const newRatings = [];

        console.log("🔄 Generating orders for each user persona...");

        // 5. Generate Orders, Items, and Ratings for each Persona
        for (const user of personaUsers) {
            const possibleDishNames = personaDishMap[user.name];
            if (!possibleDishNames) continue;

            for (let i = 0; i < NUMBER_OF_ORDERS_PER_USER; i++) {
                // Select 1 to 3 dishes for this order
                const itemsForThisOrder = [];
                const numItems = getRandomInt(1, 3);
                for (let j = 0; j < numItems; j++) {
                    const dishName = possibleDishNames[getRandomInt(0, possibleDishNames.length - 1)];
                    const dish = dishes.find(d => d.name === dishName);
                    if (dish) {
                        itemsForThisOrder.push(dish);
                    }
                }
                if (itemsForThisOrder.length === 0) continue;

                // Create the Order
                const firstDish = itemsForThisOrder[0];
                const finalTotal = itemsForThisOrder.reduce((sum, item) => sum + parseFloat(item.price), 0);
                
                const order = {
                    _id: new mongoose.Types.ObjectId(),
                    userId: new mongoose.Types.ObjectId(user.id),
                    storeId: new mongoose.Types.ObjectId(firstDish.store_id),
                    finalTotal,
                    status: "done",
                    createdAt: new Date(Date.now() - getRandomInt(0, 30) * 24 * 60 * 60 * 1000) // Random date in last 30 days
                };
                newOrders.push(order);

                // Create Order Items
                for (const dish of itemsForThisOrder) {
                    newOrderItems.push({
                        orderId: order._id,
                        dishId: new mongoose.Types.ObjectId(dish.id),
                        dishName: dish.name,
                        quantity: 1,
                        price: parseFloat(dish.price),
                        lineTotal: parseFloat(dish.price),
                    });
                }

                // Create a Rating (80% chance of rating an order)
                if (Math.random() < 0.8) {
                    newRatings.push({
                        userId: order.userId,
                        storeId: order.storeId,
                        orderId: order._id,
                        ratingValue: getRandomInt(3, 5), // Personas generally order what they like
                        comment: "Món ăn rất ngon!",
                    });
                }
            }
        }
        
        console.log(`✅ Generated ${newOrders.length} orders, ${newOrderItems.length} order items, and ${newRatings.length} ratings.`);

        // 6. Bulk Insert into Database
        console.log("💾 Inserting generated data into the database...");
        await Order.insertMany(newOrders);
        await OrderItem.insertMany(newOrderItems);
        await Rating.insertMany(newRatings);
        console.log("🎉 Seeding complete! All interaction data has been inserted.");

    } catch (error) {
        console.error("❌ A fatal error occurred during the seeding process:", error);
    } finally {
        // 7. Disconnect from the database
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log("\n🔌 MongoDB connection closed.");
        }
    }
}

// Run the seeder function
seedInteractions();