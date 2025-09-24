// utils/socketManager.js
let io = null;
const userSockets = {}; // Store socket IDs by user
const storeSockets = {}; // Store socket IDs by store

const setSocketIo = (socketIoInstance) => {
  io = socketIoInstance;
};
const getIo = () => io;
const getUserSockets = () => userSockets;

const registerUserSocket = (userId, socketId) => {
  if (!userSockets[userId]) {
    userSockets[userId] = [];
  }
  userSockets[userId].push(socketId);
};

const unregisterUserSocket = (userId, socketId) => {
  if (userSockets[userId]) {
    userSockets[userId] = userSockets[userId].filter((id) => id !== socketId);
  }
};

const registerStoreSocket = (storeId, socketId) => {
  if (!storeSockets[storeId]) {
    storeSockets[storeId] = [];
  }
  storeSockets[storeId].push(socketId);
};

const unregisterStoreSocket = (storeId, socketId) => {
  if (storeSockets[storeId]) {
    storeSockets[storeId] = storeSockets[storeId].filter((id) => id !== socketId);
  }
};

const getStoreSockets = () => storeSockets;

module.exports = {
  setSocketIo,
  getUserSockets,
  registerUserSocket,
  unregisterUserSocket,
  registerStoreSocket,
  unregisterStoreSocket,
  getStoreSockets,
  getIo
};
