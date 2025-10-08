const Account = require("../models/accounts.model");
const User = require("../models/users.model");
const Staff = require("../models/staffs.model");
const Shipper = require("../models/shippers.model");
const Admin = require("../models/admin.model");
const Store = require("../models/stores.model");
const mongoose = require("mongoose");
const ErrorCode = require("../constants/errorCodes.enum");
const createError = require("../utils/createError");
const {
  generateAccessAdminToken,
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/tokenGeneration");

/**
 * Map entity string to model.
 * Acceptable entity values: 'user', 'staff', 'shipper', 'admin'
 */
const ENTITY_MODEL = {
  user: User,
  staff: Staff,
  shipper: Shipper,
  admin: Admin,
};

/**
 * Login across entities:
 *  - find entity by email
 *  - populate accountId
 *  - verify account exists and password matches
 *  - set refreshToken on Account and save
 *
 * Returns: { response, refreshToken }
 * response contains minimal payload for client (e.g. _id and token)
 */
const loginService = async ({ entity, email, password }) => {
  if (!entity || !email || !password) throw ErrorCode.VALIDATION_ERROR;

  const Model = ENTITY_MODEL[entity];
  if (!Model) throw ErrorCode.ENTITY_NOT_SUPPORTED;

  const entityDoc = await Model.findOne({ email }).populate("accountId");
  if (!entityDoc) throw ErrorCode.ENTITY_NOT_FOUND;

  const account = entityDoc.accountId;
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  const isMatch =
    typeof account.isPasswordMatched === "function"
      ? await account.isPasswordMatched(password)
      : false;

  if (!isMatch) throw ErrorCode.INVALID_CREDENTIALS;

  const refreshToken = generateRefreshToken(account._id);
  account.refreshToken = refreshToken;
  await account.save();

  // Chuẩn bị payload để đưa vào JWT
  const payload = {
    accountId: account._id,
    entityId: entityDoc._id,
    entity, // "admin" | "staff" | "user"
    role: entityDoc.role, // nếu model có field role
  };

  const response = {
    _id: entityDoc._id,
    token: generateAccessToken(payload),
  };

  if (entity === "staff") {
    const staffId = entityDoc._id;

    // 1️⃣ Ưu tiên tìm xem staff này có phải là owner
    let storeDoc = await Store.findOne({ owner: staffId }).select("_id");

    // 2️⃣ Nếu không phải owner, kiểm tra trong mảng staff
    if (!storeDoc) {
      storeDoc = await Store.findOne({ staff: { $in: [staffId] } }).select(
        "_id"
      );
    }

    // 3️⃣ Nếu tìm được thì gán vào response
    if (storeDoc) {
      response.storeId = storeDoc._id;
    }
  }

  return { response, refreshToken };
};

const registerService = async ({
  name,
  email,
  phonenumber,
  gender,
  password,
}) => {
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

const refreshTokenService = async ({ refreshToken }) => {
  try {
    const account = await Account.findOne({ refreshToken });

    const user = await User.findOne({ accountId: account?._id });
    if (!user) {
      throw ErrorCode.INVALID_REFRESH_TOKEN;
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err || user.id !== decoded.id) throw ErrorCode.REFRESH_TOKEN_EXPIRE;
      const accessToken = generateAccessToken(user?._id);
      response = {
        accessToken,
      };
      return { response };
    });
  } catch (err) {
    throw err;
  }
};

module.exports = {
  loginService,
  registerService,
};
