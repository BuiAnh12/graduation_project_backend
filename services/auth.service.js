const Account = require("../models/accounts.model");
const User = require("../models/users.model");
const Staff = require("../models/staffs.model")
const Shipper = require("../models/shippers.model")
const Admin = require("../models/admin.model")
const mongoose = require("mongoose");
const ErrorCode = require("../constants/errorCodes.enum");
const createError = require("../utils/createError");
const {
    generateAccessAdminToken,
    generateAccessToken,
    generateRefreshToken,
} = require("../utils/tokenGeneration");

// const loginService = async ({ email, password, getRole, getStore }) => {
//   if (!email || !password) {
//     throw ErrorCode.VALIDATION_ERROR;
//   }

//   const user = await User.findOne({ email }).populate("accountId");
//   if (!user || !user.accountId) {
//     throw ErrorCode.ACCOUNT_NOT_FOUND;
//   }

//   const account = user.accountId;

//   const isMatch = await account.isPasswordMatched(password);
//   if (!isMatch) {
//     throw ErrorCode.INVALID_CREDENTIALS;
//   }

//   const refreshToken = generateRefreshToken(user._id);
//   account.refreshToken = refreshToken;
//   await account.save();

//   const response = {
//     _id: user._id,
//     token: generateAccessToken(account._id),
//   };

//   return { response, refreshToken };
// };
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
    if (!entity || !email || !password) {
        // validation error
        throw ErrorCode.VALIDATION_ERROR;
    }

    const Model = ENTITY_MODEL[entity];
    if (!Model) {
        // entity not supported
        throw ErrorCode.ENTITY_NOT_SUPPORTED
    }

    // find the entity document and populate its account
    const entityDoc = await Model.findOne({ email }).populate("accountId");
    if (!entityDoc) {
        // entity not found
        throw ErrorCode.ENTITY_NOT_FOUND
    }

    if (!entityDoc.accountId) {
        // linked account missing
        throw ErrorCode.ACCOUNT_NOT_FOUND;
    }

    const account = entityDoc.accountId;

    // If your Account model implements isPasswordMatched, use it. Otherwise compare hash.
    const isMatch =
        typeof account.isPasswordMatched === "function"
            ? await account.isPasswordMatched(password)
            : false;

    if (!isMatch) {
        // invalid credentials
        throw ErrorCode.INVALID_CREDENTIALS;
    }

    // generate refresh token and save it to account
    const refreshToken = generateRefreshToken(account._id);
    account.refreshToken = refreshToken;
    await account.save();

    const response = {
        _id: entityDoc._id,
        token: generateAccessToken(entityDoc._id),
        // if you want to include role/site metadata later, add it here
    };

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

        jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET,
            (err, decoded) => {
                if (err || user.id !== decoded.id)
                    throw ErrorCode.REFRESH_TOKEN_EXPIRE;
                const accessToken = generateAccessToken(user?._id);
                response = {
                    accessToken,
                };
                return { response };
            }
        );
    } catch (err) {
        throw err;
    }
};

module.exports = {
    loginService,
    registerService,
};
