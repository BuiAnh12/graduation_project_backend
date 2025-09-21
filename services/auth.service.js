const Account = require("../models/accounts.model");
const User = require("../models/users.model");
const Store = require("../models/stores.model");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const createError = require("../utils/createError");

const hashPassword = (password, salt) => {
  return crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
};

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const generateAccessAdminToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });
};

const loginService = async ({ email, password, getRole, getStore }) => {
  if (!email || !password) {
    throw createError(400, { message: "Email and password are required" });
  }

  // find user with populated account
  const user = await User.findOne({ email }).populate("acountId");
  if (!user || !user.acountId) {
    throw createError(401, { message: "Invalid email or password" });
  }

  const account = user.acountId;

  // password check (stored as hash)
  if (account.password !== hashPassword(password, account.salt || "")) {
    throw createError(401, { message: "Invalid email or password" });
  }

  // generate refreshToken and update account
  const refreshToken = generateRefreshToken(account._id);
  account.refreshToken = refreshToken;
  await account.save();

  // check if this user belongs to a store
  const store = await Store.findOne({
    $or: [{ owner: user._id }, { staff: user._id }],
  }).select("_id name owner");

  const response = {
    _id: user._id,
    token: generateAccessToken(account._id),
  };

  if (getRole === "true") {
    response.role = account.role || "user";
  }

  if (getStore === "true" && store) {
    response.storeId = store._id;
    response.ownerId = store.owner;
  }

  return { response, refreshToken };
};

module.exports = {
  loginService,
};
