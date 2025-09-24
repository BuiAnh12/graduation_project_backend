const Account = require("../models/accounts.model");
const User = require("../models/users.model");
const mongoose = require("mongoose");
const ErrorCode = require("../constants/errorCodes.enum");
const createError = require("../utils/createError");
const {
  generateAccessAdminToken,
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/tokenGeneration");

const loginService = async ({ email, password, getRole, getStore }) => {
  if (!email || !password) {
    throw ErrorCode.VALIDATION_ERROR;
  }

  const user = await User.findOne({ email }).populate("accountId");
  if (!user || !user.accountId) {
    throw ErrorCode.ACCOUNT_NOT_FOUND;
  }

  const account = user.accountId;

  const isMatch = await account.isPasswordMatched(password);
  if (!isMatch) {
    throw ErrorCode.INVALID_CREDENTIALS;
  }

  const refreshToken = generateRefreshToken(account._id);
  account.refreshToken = refreshToken;
  await account.save();

  const response = {
    _id: user._id,
    token: generateAccessToken(account._id),
  };

  return { response, refreshToken };
};

const registerService = async ({ name, email, phonenumber, gender, password }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await User.findOne({ email }).session(session);
    if (user) {
      throw ErrorCode.ACCOUNT_ALREADY_EXISTED;
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
