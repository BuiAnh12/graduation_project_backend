const ErrorCode = require("../constants/errorCodes.enum");
const Account = require("../models/accounts.model");
const Admin = require("../models/admin.model");

// Tạo account + admin
const createAccountService = async ({
  name,
  email,
  phonenumber,
  gender,
  role,
}) => {
  // --- Validate thiếu trường ---
  if (!name || !email || !role) {
    throw ErrorCode.MISSING_REQUIRED_FIELDS;
  }

  // --- Kiểm tra email đã tồn tại ---
  const existEmail = await Admin.findOne({ email });
  if (existEmail) throw ErrorCode.EMAIL_EXISTS;

  // --- Tạo account ---
  const account = await Account.create({
    password: phonenumber, // mặc định là số điện thoại
    isGoogleLogin: false,
    blocked: false,
  });

  // --- Tạo admin ---
  const admin = await Admin.create({
    accountId: account._id,
    name,
    email,
    phonenumber,
    gender,
    role: Array.isArray(role) ? role : [role],
    avatarImage: "68d90a4eb6744ebb6290c238",
  });

  return await Admin.findById(admin._id).populate("accountId");
};

// Lấy tất cả admin
const getAllAdService = async (userId, query) => {
  const {
    role,
    search,
    sortBy = "createdAt",
    order = "desc",
    blocked, // "true" | "false" | "all"
    page = 1,
    limit = 10,
  } = query;

  const filter = {
    // ❌ Bỏ qua SUPER_ADMIN và CHIEF_MANAGER
    role: { $nin: ["SUPER_ADMIN", "CHIEF_MANAGER"] },
  };

  // --- Filter theo role (chỉ khi hợp lệ) ---
  if (role && !["SUPER_ADMIN", "CHIEF_MANAGER"].includes(role)) {
    filter.role = { $in: [role] };
  }

  // --- Bỏ qua chính người đang truy vấn ---
  if (userId) {
    filter._id = { $ne: userId };
  }

  // --- Search theo name hoặc email ---
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  // --- Sort setup ---
  const sort = {};
  sort[sortBy] = order === "asc" ? 1 : -1;

  // --- Pagination setup ---
  const skip = (page - 1) * limit;

  // --- Truy vấn chính ---
  let adminList = await Admin.find(filter)
    .populate({
      path: "accountId",
      select: "blocked",
    })
    .populate("avatarImage")
    .sort(sort);

  // --- Ưu tiên staff chưa bị block ---
  adminList.sort((a, b) => {
    const aBlocked = a.accountId?.blocked ?? false;
    const bBlocked = b.accountId?.blocked ?? false;
    if (aBlocked === bBlocked) return 0;
    return aBlocked ? 1 : -1;
  });

  // --- Filter blocked ---
  if (blocked === "true") {
    adminList = adminList.filter((s) => s.accountId?.blocked === true);
  } else if (blocked === "false") {
    adminList = adminList.filter((s) => s.accountId?.blocked === false);
  }

  // --- Pagination ---
  const totalItems = adminList.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedAdmin = adminList.slice(skip, skip + parseInt(limit));

  return {
    admin: paginatedAdmin,
    meta: {
      totalItems,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit),
    },
  };
};

// Lấy admin theo ID
const getAdminByIdService = async (id) => {
  const admin = await Admin.findById(id).populate("accountId");
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;
  return admin;
};

// Sửa thông tin admin
const editAdminService = async (
  adminId,
  { name, phonenumber, gender, role }
) => {
  const admin = await Admin.findById(adminId);
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  // --- Cập nhật các trường ---
  admin.name = name ?? admin.name;
  admin.phonenumber = phonenumber ?? admin.phonenumber;
  admin.gender = gender ?? admin.gender;

  // ✅ Đảm bảo role luôn là mảng
  if (role) {
    admin.role = Array.isArray(role) ? role : [role];
  }

  await admin.save();

  // ✅ Populate accountId trước khi trả về
  return await Admin.findById(admin._id).populate("accountId");
};

// Xóa admin + account liên quan
const deleteAdminService = async (id) => {
  const admin = await Admin.findById(id);
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  await Account.findByIdAndDelete(admin.accountId);
  await Admin.findByIdAndDelete(id);

  return { message: "Admin and related account deleted successfully" };
};

const toggleAdminAccountStatusService = async (adminId) => {
  // Tìm nhân viên
  const admin = await Admin.findById(adminId);
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  // Tìm account liên kết
  const account = await Account.findById(admin.accountId);
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  // Cập nhật trạng thái khóa
  account.blocked = !account.blocked;
  await account.save();

  return {
    success: true,
    blocked: account.blocked,
    message: `Account has been ${
      account.blocked ? "blocked" : "unblocked"
    } successfully.`,
  };
};

module.exports = {
  createAccountService,
  getAllAdService,
  getAdminByIdService,
  editAdminService,
  deleteAdminService,
  toggleAdminAccountStatusService,
};
