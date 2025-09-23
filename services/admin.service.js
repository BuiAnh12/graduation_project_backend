const ErrorCode = require("../constants/errorCodes.enum");
const Account = require("../models/accounts.model");
const Admin = require("../models/admin.model");

// Tạo account + admin
const createAccountService = async ({
  password,
  name,
  email,
  phonenumber,
  gender,
  role,
}) => {
  // Validate thiếu trường
  if (!password || !name || !email || !role) {
    throw ErrorCode.MISSING_REQUIRED_FIELDS;
  }

  const existEmail = await Admin.findOne({ email });
  if (existEmail) throw ErrorCode.EMAIL_EXISTS;

  const account = await Account.create({
    password,
    isGoogleLogin: false,
    blocked: false,
  });

  const admin = await Admin.create({
    accountId: account._id,
    name,
    email,
    phonenumber,
    gender,
    role,
  });

  return await Admin.findById(admin._id).populate("accountId");
};

// Lấy tất cả admin
const getAllAdService = async () => {
  return await Admin.find().populate("accountId");
};

// Lấy admin theo ID
const getAdminByIdService = async (id) => {
  const admin = await Admin.findById(id).populate("accountId");
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;
  return admin;
};

// Sửa thông tin admin
const editAdminService = async (
  id,
  { name, email, phonenumber, gender, role, blocked }
) => {
  const admin = await Admin.findById(id);
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  // Validate email mới nếu có
  if (email && email !== admin.email) {
    const existEmail = await Admin.findOne({ email });
    if (existEmail) throw ErrorCode.EMAIL_EXISTS;
    admin.email = email;
  }

  // Không bắt buộc, nhưng có thể enforce name không rỗng
  if (name !== undefined && !name.trim()) {
    throw ErrorCode.MISSING_REQUIRED_FIELDS;
  }

  if (name) admin.name = name;
  if (phonenumber) admin.phonenumber = phonenumber;
  if (gender) admin.gender = gender;
  if (role) admin.role = role;

  await admin.save();

  if (blocked !== undefined) {
    const account = await Account.findById(admin.accountId);
    account.blocked = blocked;
    await account.save();
  }

  return await Admin.findById(id).populate("accountId");
};

// Xóa admin + account liên quan
const deleteAdminService = async (id) => {
  const admin = await Admin.findById(id);
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  await Account.findByIdAndDelete(admin.accountId);
  await Admin.findByIdAndDelete(id);

  return { message: "Admin and related account deleted successfully" };
};

module.exports = {
  createAccountService,
  getAllAdService,
  getAdminByIdService,
  editAdminService,
  deleteAdminService,
};
