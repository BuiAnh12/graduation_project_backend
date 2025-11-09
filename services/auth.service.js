const Account = require("../models/accounts.model");
const User = require("../models/users.model");
const Staff = require("../models/staffs.model");
const Shipper = require("../models/shippers.model");
const Admin = require("../models/admin.model");
const Store = require("../models/stores.model");
const mongoose = require("mongoose");
const ErrorCode = require("../constants/errorCodes.enum");
const createError = require("../utils/createError");
const jwt = require("jsonwebtoken");
const {
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
  console.log(email, password)
  const Model = ENTITY_MODEL[entity];
  if (!Model) throw ErrorCode.ENTITY_NOT_SUPPORTED;

  const entityDoc = await Model.findOne({ email }).populate("accountId");
  if (!entityDoc) throw ErrorCode.ENTITY_NOT_FOUND;

  const account = entityDoc.accountId;
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;
  if (account.blocked) throw ErrorCode.ACCOUNT_BLOCKED;

  // 🚫 Nếu là shipper và firstCheck === true thì không cho login
  if (entity === "shipper" && entityDoc.firstCheck === true) {
    throw ErrorCode.SHIPPER_FIRST_CHECK_REQUIRED;
    // hoặc có thể tạo custom error message:
    // throw new Error("Shipper must complete first check before login.");
  }

  const isMatch =
    typeof account.isPasswordMatched === "function"
      ? await account.isPasswordMatched(password)
      : false;

  if (!isMatch) throw ErrorCode.INVALID_CREDENTIALS;

  const refreshToken = generateRefreshToken(account._id);
  account.refreshToken = refreshToken;
  await account.save();

  // JWT payload
  const payload = {
    accountId: account._id,
    entityId: entityDoc._id,
    entity,
    role: entityDoc.role,
  };

  const response = {
    _id: entityDoc._id,
    token: generateAccessToken(payload),
    refreshToken: refreshToken,
  };

  // Nếu là staff → tìm store gắn kèm
  if (entity === "staff") {
    const staffId = entityDoc._id;

    // 1️⃣ Kiểm tra owner
    let storeDoc = await Store.findOne({ owner: staffId }).select("_id name");

    // 2️⃣ Nếu không phải owner, kiểm tra trong mảng staff
    if (!storeDoc) {
      storeDoc = await Store.findOne({ staff: { $in: [staffId] } }).select(
        "_id name"
      );
    }

    // 3️⃣ Nếu có thì thêm vào response
    if (storeDoc) {
      response.storeId = storeDoc._id;
      response.storeName = storeDoc.name;
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

const refreshTokenService = async ({ refreshToken, entity }) => {
  if (!refreshToken || !entity) throw ErrorCode.VALIDATION_ERROR;
  const Model = ENTITY_MODEL[entity];
  if (!Model) throw ErrorCode.ENTITY_NOT_SUPPORTED;

  // Tìm account dựa trên refreshToken
  const account = await Account.findOne({ refreshToken });
  if (!account) throw ErrorCode.INVALID_REFRESH_TOKEN;
  // Tìm entityDoc tương ứng với account
  const entityDoc = await Model.findOne({ accountId: account._id });
  if (!entityDoc) throw ErrorCode.ENTITY_NOT_FOUND;

  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw ErrorCode.REFRESH_TOKEN_EXPIRE;
  }

  if (decoded.id !== account._id.toString()) {
    throw ErrorCode.REFRESH_TOKEN_EXPIRE;
  }

  // Tạo payload giống loginService
  const payload = {
    accountId: account._id,
    entityId: entityDoc._id,
    entity,
    role: entityDoc.role,
  };

  const newAccessToken = generateAccessToken(payload);

  const response = {
    _id: entityDoc._id,
    token: newAccessToken,
    refreshToken: refreshToken, // vẫn dùng refreshToken cũ
  };

  // Nếu là staff → tìm store gắn kèm
  if (entity === "staff") {
    const staffId = entityDoc._id;

    let storeDoc = await Store.findOne({ owner: staffId }).select("_id name");
    if (!storeDoc) {
      storeDoc = await Store.findOne({ staff: { $in: [staffId] } }).select(
        "_id name"
      );
    }

    if (storeDoc) {
      response.storeId = storeDoc._id;
      response.storeName = storeDoc.name;
    }
  }

  return { response };
};

const refreshTokenAdminService = async ({ refreshToken }) => {
  try {
    const account = await Account.findOne({ refreshToken });

    const user = await Admin.findOne({ accountId: account?._id });
    console.log("REFRESH TOKEN: ", refreshToken);
    console.log("USER ADMIN: ", user);
    if (!user) {
      throw ErrorCode.INVALID_REFRESH_TOKEN;
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err || account.id !== decoded.id)
        throw ErrorCode.REFRESH_TOKEN_EXPIRE;
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

// const googleLoginService = async ({ token }) => {
//   if (!token) throw ErrorCode.VALIDATION_ERROR;

//   const ticket = await client.verifyIdToken({
//     idToken: token,
//     audience: process.env.GOOGLE_CLIENT_ID,
//   });
//   const payload = ticket.getPayload();

//   let user = await User.findOne({ email: payload.email });

//   if (!user) {
//     user = await User.create({
//       name: payload.name,
//       email: payload.email,
//       password: crypto.randomBytes(32).toString("hex"),
//       avatar: { url: payload.picture },
//       isGoogleLogin: true,
//     });
//   } else if (!user.isGoogleLogin) {
//     throw ErrorCode.USER_ALREADY_EXISTS;
//   }

//   const refreshToken = generateRefreshToken(user._id);
//   await User.findByIdAndUpdate(user._id, { refreshToken });

//   const response = {
//     _id: user._id,
//     token: generateAccessToken(user._id),
//   };

//   return { response, refreshToken };
// };

const logoutService = async (refreshToken) => {
  const user = await User.findOne({ refreshToken });
  if (user) {
    await User.findOneAndUpdate(
      { refreshToken },
      { $set: { refreshToken: null } }
    );
  }
  return true;
};

const changePasswordService = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) throw ErrorCode.USER_NOT_FOUND;
  const account = await Account.findById(user.accountId);

  const isMatch = await account.isPasswordMatched(oldPassword);
  if (!isMatch) throw ErrorCode.PASSWORD_INCORRECT;

  user.password = newPassword;
  await user.save();

  return { success: true };
};

const forgotPasswordService = async (email) => {
  const user = await User.findOne({ email, isGoogleLogin: false });
  if (!user) throw ErrorCode.USER_NOT_FOUND;

  const otp = await user.createOtp();
  await user.save();

  const html = `<p>Mã OTP của bạn là: ${otp}</p><p>OTP sẽ hết hạn trong 2 phút.</p>`;
  await sendEmail({ to: email, subject: "Forgot Password OTP", html });

  return { success: true };
};

const checkOTPService = async (email, otp) => {
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
  const user = await User.findOne({
    email,
    otp: hashedOTP,
    otpExpires: { $gt: Date.now() },
  });

  if (!user) throw ErrorCode.OTP_INVALID_OR_EXPIRED;

  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  return { success: true };
};

module.exports = {
  registerService,
  loginService,
  // googleLoginService,
  refreshTokenService,
  refreshTokenAdminService,
  logoutService,
  changePasswordService,
  forgotPasswordService,
  checkOTPService,
};
