const {
  createStaffService,
  getAllStaffByStoreIdService,
  updateStaffService,
  getStaffByIdService,
  deleteStaffService,
  checkEmailService,
  toggleStaffAccountStatusService,
} = require("../services/staff.service");
const ApiResponse = require("../utils/apiResponse");

const getAllStaffByStore = async (req, res) => {
  try {
    const { staff, meta } = await getAllStaffByStoreIdService(
      req.params.storeId,
      req.query
    );
    return ApiResponse.success(
      res,
      staff,
      "Staff fetched successfully",
      200,
      meta
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const createStaff = async (req, res) => {
  try {
    const staff = await createStaffService(req.body || {});
    return ApiResponse.success(res, staff, "Staff created successfully", 201);
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const updateStaff = async (req, res) => {
  try {
    const staff = await updateStaffService(req.params.staffId, req.body || {});
    return ApiResponse.success(res, staff, "Staff updated successfully", 200);
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const getStaffById = async (req, res) => {
  try {
    const staff = await getStaffByIdService(req.params.staffId);
    return ApiResponse.success(res, staff, "Staff get successfully", 200);
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};
const deleteStaff = async (req, res) => {
  try {
    await deleteStaffService(req.params.staffId, req.params.storeId);
    return ApiResponse.success(res, null, "Staff deleted successfully", 200);
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};
const toggleAccoutStaffStatus = async (req, res) => {
  try {
    const result = await toggleStaffAccountStatusService(req.params.staffId);
    return ApiResponse.success(
      res,
      null,
      "Staff change status successfully",
      200
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const checkEmail = async (req, res) => {
  try {
    const result = await checkEmailService(req.body || {});
    return ApiResponse.success(res, result, "Valid", 200);
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

module.exports = {
  getAllStaffByStore,
  createStaff,
  updateStaff,
  getStaffById,
  deleteStaff,
  checkEmail,
  toggleAccoutStaffStatus,
};
