const Account = require("../models/accounts.model");
const User = require("../models/users.model");
const Store = require("../models/stores.model");
const mongoose = require("mongoose");
const createError = require("../utils/createError");
const {
  generateAccessAdminToken,
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/tokenGeneration");

const loginService = async ({ email, password, getRole, getStore }) => {
  if (!email || !password) {
    throw createError(400, { message: "Email and password are required" });
  }

  const user = await User.findOne({ email }).populate("accountId");
  if (!user || !user.accountId) {
    throw createError(401, { message: "Invalid email or password" });
  }

  const account = user.accountId;

  const isMatch = await account.isPasswordMatched(password);
  if (!isMatch) {
    throw createError(401, { message: "Invalid email or password" });
  }

  const refreshToken = generateRefreshToken(account._id);
  account.refreshToken = refreshToken;
  await account.save();

  const response = {
    _id: user._id,
    token: generateAccessToken(account._id),
  };

  if (getRole === "true") {
    response.role = account.role || "user";
  }

  if (getStore === "true") {
    const store = await Store.findOne({
      $or: [{ owner: user._id }, { staff: user._id }],
    }).select("_id name owner");

    if (store) {
      response.storeId = store._id;
      response.ownerId = store.owner;
    }
  }

  return { response, refreshToken };
};

const registerService = async ({ name, email, phonenumber, gender, password }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await User.findOne({ email }).session(session);
    if (user) {
      throw createError(409, { message: "User already existed" });
    }

    const account = await Account.create(
      [
        {
          password,
          isGoogleLogin: false,
        },
      ],
      { session }
    );

    const newUser = await User.create(
      [
        {
          name,
          email,
          phonenumber,
          gender,
          accountId: account[0]._id,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return { response: newUser[0] };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = {
  loginService,
  registerService,
};
