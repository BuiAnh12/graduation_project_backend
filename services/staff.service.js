const ErrorCode = require("../constants/errorCodes.enum");
const Account = require("../models/accounts.model");
const Staff = require("../models/staffs.model");
const Store = require("../models/stores.model");

const getAllStaffByStoreIdService = async (storeId) => {
  const store = await Store.findById(storeId).populate({
    path: "staff",
    populate: { path: "accountId" },
  });
  if (!store) throw ErrorCode.STORE_NOT_FOUND;
  return store.staff;
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

const getStaffByIdService = async (staffId) => {
  const staff = await Staff.findById(staffId).populate("accountId");
  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;
  return staff;
};
module.exports = {
  getAllStaffByStoreIdService,
  createStaffService,
  updateStaffService,
  deleteStaffService,
  getStaffByIdService,
};
