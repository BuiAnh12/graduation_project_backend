const Admin = require("../models/admin.model");
const Account = require("../models/accounts.model");
const ErrorCode = require("../constants/errorCodes.enum");

const getProfileService = async (adminId) => {
  console.log(adminId);
  if (!adminId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  // 1. Tìm admin theo id, populate account và avatarImage
  const admin = await Admin.findById(adminId)
    .populate({ path: "accountId" }) // populate thật, không phải virtual
    .populate({ path: "avatarImage" }); // populate ảnh

  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  return admin;
};

const updateProfileService = async (adminId, payload) => {
  if (!adminId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const admin = await Admin.findById(adminId);
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  // Nếu có email mới thì kiểm tra trùng
  if (payload.email && payload.email !== admin.email) {
    const existedEmail = await Admin.findOne({ email: payload.email });
    if (existedEmail) throw ErrorCode.EMAIL_EXISTS;
  }

  // Cập nhật thông tin
  if (payload.name) admin.name = payload.name;
  if (payload.email) admin.email = payload.email;
  if (payload.phonenumber) admin.phonenumber = payload.phonenumber;
  if (payload.gender) admin.gender = payload.gender;
  if (payload.avatarImage) admin.avatarImage = payload.avatarImage;

  await admin.save();

  // populate lại để trả về dữ liệu đầy đủ
  const updatedAdmin = await Admin.findById(admin._id)
    .populate({ path: "accountId" })
    .populate({ path: "avatarImage" });

  return updatedAdmin;
};

const checkCurrentPasswordService = async (adminId, currentPassword) => {
  if (!adminId || !currentPassword) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  // 1️⃣ Lấy admin và populate account
  const admin = await Admin.findById(adminId).populate("accountId");
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  const account = await Account.findById(admin.accountId).select("+password");
  console.log("Account", account);
  console.log("Current password", currentPassword);
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  // 2️⃣ Gọi hàm isPasswordMatched y như loginService
  const isMatch =
    typeof account.isPasswordMatched === "function"
      ? await account.isPasswordMatched(currentPassword)
      : false;

  // 3️⃣ Trả về true/false
  return isMatch;
};

const updatePasswordService = async (adminId, { newPassword }) => {
  if (!adminId || !newPassword) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const admin = await Admin.findById(adminId);
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  const account = await Account.findById(admin.accountId);
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  account.password = newPassword;
  await account.save();

  return { success: true, message: "Cập nhật mật khẩu thành công" };
};

module.exports = {
  getProfileService,
  updateProfileService,
  checkCurrentPasswordService,
  updatePasswordService,
};
