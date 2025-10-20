const mongoose = require('mongoose');
require("dotenv").config();

// --- Database Connection ---
// IMPORTANT: Replace this with your actual MongoDB connection string
const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/yourdbname";

const Store = require("../../models/stores.model")

// --- 2. Mongoose-Compatible Data ---

// Base store data, cleaned for Mongoose.
// We remove `$oid`, `createdAt`, `updatedAt`, and `__v`.
// Mongoose will cast the strings to ObjectIds.
const mongooseBaseStore = {
  name: "Demo Pizza",
  description: "Best pizza in town",
  address_full: "97 Man Thiện",
  systemCategoryId: [ "68d90d09cc13412f4ac887fc" ], // Mongoose accepts string array
  status: "approved",
  openStatus: "opened",
  openHour: "07:00",
  closeHour: "19:30",
  avatarImage: "68e54768abb19a3cd4c61dbc", // Mongoose accepts string
  coverImage: "68e54768abb19a3cd4c61dbe",
  location: {
    type: "Point",
    lat: "10.7626",
    lon: "106.7009"
  },
  owner: "68dfd3e078fa936ef7ac0448",
  BusinessLicenseImage: "68e54f2b82135c4fbac7e278",
  ICBackImage: "68e54922abb19a3cd4c61dfb",
  ICFrontImage: "68e54922abb19a3cd4c61df9"
};

// New store data, cleaned for Mongoose (removed `$oid`)
const mongooseStoreData = [
  {
    name: "Quán Ăn Gia Đình Việt",
    description: "Traditional Vietnamese family restaurant",
    location: { type: "Point", coordinates: [106.700981, 10.776889] },
    address_full: "123 Nguyễn Huệ, Quận 1, TP.HCM",
    status: "approved",
    openStatus: "opened",
    openHour: "08:00",
    closeHour: "18:00",
    owner: "68f305ace2da7af438656b0c",
  },
  {
    name: "Asian Fusion Kitchen",
    description: "Modern Asian fusion restaurant with global flavors",
    location: { type: "Point", coordinates: [106.695439, 10.780627] },
    address_full: "45 Lý Tự Trọng, Quận 1, TP.HCM",
    status: "approved",
    openStatus: "opened",
    openHour: "09:00",
    closeHour: "22:00",
    owner: "68f305d8e2da7af438656b13",
  },
];

// --- 3. Insertion Logic ---

// Create the merged store objects
const clonedStores = mongooseStoreData.map(newData => {
  return {
    ...mongooseBaseStore, // Apply all properties from the base template
    ...newData            // Override with new, specific properties
  };
});

// Main function to connect and insert
async function insertClonedStores() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully.");

    // Delete store if existed
    const storeName = mongooseStoreData.map(s=> s.name)
    await Store.deleteMany({name: {$in: storeName}});
    console.log("Remove old document")

    // Insert the documents
    // We use insertMany for efficiency
    console.log("Inserting new stores...");
    const result = await Store.insertMany(clonedStores);
    
    console.log("Successfully inserted 2 stores:");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error inserting documents:", error.message);
    if (error.code === 11000) {
      console.error("Duplicate key error: A store with one of these names might already exist.");
    }
  } finally {
    // Always close the connection
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

// Run the insertion script
insertClonedStores();