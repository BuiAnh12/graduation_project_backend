const admin = require("firebase-admin");
const multer = require("multer");
const path = require("path");

// Load your service account key JSON (download from Firebase Console > Project Settings > Service Accounts)
const serviceAccount = require(path.join(__dirname, "../config/serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGEBUCKET, // e.g. "ptitfoodordering.appspot.com"
});

// Access the storage bucket
const bucket = admin.storage().bucket();

// Multer middleware (for handling file uploads in memory before pushing to Firebase)
const uploadToFirebase = multer({ storage: multer.memoryStorage() });

module.exports = { uploadToFirebase, bucket };
