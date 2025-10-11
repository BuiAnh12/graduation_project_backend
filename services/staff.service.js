const ErrorCode = require("../constants/errorCodes.enum");
const Account = require("../models/accounts.model");
const Staff = require("../models/staffs.model");
const Store = require("../models/stores.model");

const getAllStaffByStoreIdService = async (storeId, query) => {
  const {
    role,
    search,
    sortBy = "createdAt",
    order = "desc",
    blocked, // true | false | all
    page = 1,
    limit = 10,
  } = query;

  // --- Kiểm tra store tồn tại ---
  const store = await Store.findById(storeId);
  if (!store) throw ErrorCode.STORE_NOT_FOUND;

  // --- Base query: chỉ lấy staff thuộc store này ---
  const staffIds = store.staff.filter(
    (id) => id.toString() !== store.owner.toString() // ✅ loại bỏ owner
  );

  const filter = { _id: { $in: staffIds } };

  // --- Filter theo role ---
  if (role) {
    filter.role = { $in: [role] };
  }

  // --- Search theo name ---
  if (search) {
    filter.name = { $regex: search, $options: "i" }; // tìm gần đúng, không phân biệt hoa/thường
  }

  // --- Sort setup ---
  const sort = {};
  sort[sortBy] = order === "asc" ? 1 : -1;

  // --- Pagination setup ---
  const skip = (page - 1) * limit;

  // --- Lấy staff ---
  let staffList = await Staff.find(filter)
    .populate({
      path: "accountId",
      select: "blocked", // chỉ cần field blocked
    })
    .populate("avatarImage")
    .sort(sort);

  // --- Ưu tiên staff chưa bị block ---
  staffList.sort((a, b) => {
    const aBlocked = a.accountId?.blocked ?? false;
    const bBlocked = b.accountId?.blocked ?? false;
    if (aBlocked === bBlocked) return 0;
    return aBlocked ? 1 : -1; // false (không bị block) lên trước
  });

  // --- Filter theo trạng thái blocked nếu có ---
  if (blocked === "true") {
    staffList = staffList.filter((s) => s.accountId?.blocked === true);
  } else if (blocked === "false") {
    staffList = staffList.filter((s) => s.accountId?.blocked === false);
  }

  const totalItems = staffList.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedStaff = staffList.slice(skip, skip + parseInt(limit));

  return {
    staff: paginatedStaff,
    meta: {
      totalItems,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit),
    },
  };
};

const createStaffService = async ({
  name,
  email,
  phonenumber,
  gender,
  role,
  storeId,
}) => {
  // Validate thiếu trường
  if (!name || !email || !role || !phonenumber || !storeId) {
    throw ErrorCode.MISSING_REQUIRED_FIELDS;
  }

  // Check email đã tồn tại chưa
  const existEmail = await Staff.findOne({ email });
  if (existEmail) throw ErrorCode.EMAIL_EXISTS;

  // Với staff thường → password mặc định là số điện thoại
  const account = await Account.create({
    password: phonenumber,
    isGoogleLogin: false,
    blocked: false,
  });

  // Tạo staff
  const staff = await Staff.create({
    accountId: account._id,
    name,
    email,
    phonenumber,
    gender,
    role,
  });

  // Thêm staff vào store
  await Store.findByIdAndUpdate(storeId, {
    $push: { staff: staff._id },
  });

  return await Staff.findById(staff._id).populate("accountId");
};

const updateStaffService = async (
  staffId,
  { name, phonenumber, gender, role }
) => {
  const staff = await Staff.findById(staffId);
  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;

  staff.name = name ?? staff.name;
  staff.phonenumber = phonenumber ?? staff.phonenumber;
  staff.gender = gender ?? staff.gender;
  staff.role = role ?? staff.role;

  await staff.save();
  return await Staff.findById(staff._id).populate("accountId");
};

const deleteStaffService = async (staffId, storeId) => {
  const staff = await Staff.findById(staffId);
  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;
  await Store.findByIdAndUpdate(storeId, { $pull: { staff: staff._id } });
  await Account.findByIdAndDelete(staff.accountId);
  await Staff.findByIdAndDelete(staffId);
  return { success: true };
};
const toggleStaffAccountStatusService = async (staffId) => {
  // Tìm nhân viên
  const staff = await Staff.findById(staffId);
  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;

  // Tìm account liên kết
  const account = await Account.findById(staff.accountId);
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

const getStaffByIdService = async (staffId) => {
  const staff = await Staff.findById(staffId).populate("accountId");
  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;
  return staff;
};
const checkEmailService = async ({ email }) => {
  // Validate thiếu trường
  if (!email) {
    throw ErrorCode.MISSING_REQUIRED_FIELDS;
  }
  // Check email đã tồn tại chưa
  const existEmail = await Staff.findOne({ email });
  if (existEmail) throw ErrorCode.EMAIL_EXISTS;

  return true;
};
module.exports = {
  getAllStaffByStoreIdService,
  createStaffService,
  updateStaffService,
  deleteStaffService,
  getStaffByIdService,
  checkEmailService,
  toggleStaffAccountStatusService,
};
