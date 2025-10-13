const User = require("../models/users.model");
const Account = require("../models/accounts.model");
const ErrorCode = require("../constants/errorCodes.enum");

const getUserService = async (id) => {
  const user = await User.findById(id).populate({
    path: "avatarImage",
    select: "_id url",
  });

  if (!user) throw ErrorCode.USER_NOT_FOUND;
  return user;
};

const updateUserService = async (userId, updateData) => {
  const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

  if (!user) throw ErrorCode.USER_NOT_FOUND;
  return user;
};

// ADMIN SITE
const getAllUsersService = async (query) => {
  const {
    search,
    sortBy = "createdAt",
    order = "desc",
    blocked, // "true" | "false" | "all"
    page = 1,
    limit = 10,
  } = query;

  const filter = {};

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

  // --- Query chính ---
  let userList = await User.find(filter)
    .populate({
      path: "accountId",
      select: "blocked",
      strictPopulate: false, // tránh lỗi khi accountId không tồn tại
    })
    .populate({
      path: "avatarImage",
      strictPopulate: false,
    })
    .sort(sort)
    .lean(); // trả về object thuần, tránh lỗi khi thao tác sâu

  // --- Lọc bỏ user không có accountId hợp lệ ---
  userList = userList.filter((u) => u && u.accountId && u.accountId._id);

  // --- Ưu tiên user chưa bị block ---
  userList.sort((a, b) => {
    const aBlocked = a.accountId?.blocked ?? false;
    const bBlocked = b.accountId?.blocked ?? false;
    if (aBlocked === bBlocked) return 0;
    return aBlocked ? 1 : -1;
  });

  // --- Filter blocked ---
  if (blocked === "true") {
    userList = userList.filter((u) => u.accountId?.blocked === true);
  } else if (blocked === "false") {
    userList = userList.filter((u) => u.accountId?.blocked === false);
  }

  // --- Pagination ---
  const totalItems = userList.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedUsers = userList.slice(skip, skip + parseInt(limit));

  return {
    users: paginatedUsers,
    meta: {
      totalItems,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit),
    },
  };
};

const toggleUserAccountStatusService = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw ErrorCode.USER_NOT_FOUND;

  // Tìm account liên kết
  const account = await Account.findById(user.accountId);
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
  getUserService,
  updateUserService,
  getAllUsersService,
  toggleUserAccountStatusService,
};
