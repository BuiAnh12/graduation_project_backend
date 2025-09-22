const Admin = require("../models/admin.model");
const Account = require("../models/accounts.model");
const {
  generateAccessAdminToken,
  generateRefreshToken,
} = require("../utils/tokenGeneration");

const loginAdminService = async (email, password) => {
  // 1. Tìm admin theo email và populate account
  const admin = await Admin.findOne({ email });
  if (!admin) throw new Error("Admin not found");

  const account = await Account.findById(admin.accountId);
  if (!account) throw new Error("Account not found");

  // 2. Check password
  const isMatch = await account.isPasswordMatched(password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  // 3. Sinh token
  const accessToken = generateAccessAdminToken(account._id, admin._id, "ADMIN");
  const refreshToken = generateRefreshToken(account._id);

  // 4. Lưu refreshToken vào account
  account.refreshToken = refreshToken;
  await account.save();

  return {
    accessToken,
    refreshToken,
    admin: {
      id: admin._id,
      role: "ADMIN",
    },
  };
};

module.exports = { loginAdminService };
