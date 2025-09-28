const {
  createStaffService,
  getAllStaffByStoreIdService,
  updateStaffService,
  getStaffByIdService,
  deleteStaffService,
} = require("../services/staff.service");
const ApiResponse = require("../utils/apiResponse");

const getAllStaffByStore = async (req, res) => {
  try {
    const staff = await getAllStaffByStoreIdService(req.params.storeId);
    return ApiResponse.success(res, staff, "Staff get all successfully", 200);
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
    const staff = await deleteStaffService(req.body || {});
    return ApiResponse.success(res, null, "Staff deleted successfully", 204);
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
};
