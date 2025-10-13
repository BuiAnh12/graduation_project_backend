const {
  getUserService,
  updateUserService,
  getAllUsersService,
  toggleUserAccountStatusService,
} = require("../services/user.service");
const ApiResponse = require("../utils/apiResponse");

const getUser = async (req, res) => {
  try {
    const user = await getUserService(req.params.id);
    return ApiResponse.success(res, user, "User fetched successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await updateUserService(req.user._id, req.body);
    return ApiResponse.success(res, user, "User updated successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getAllUser = async (req, res) => {
  try {
    const { users, meta } = await getAllUsersService(req.query); // ✅ destructuring
    return ApiResponse.success(
      res,
      users,
      "Users fetched successfully",
      200,
      meta
    );
  } catch (err) {
    return ApiResponse.error(res, err, err.message);
  }
};

const toggleUserAccountStatus = async (req, res) => {
  try {
    const result = await toggleUserAccountStatusService(req.params.userId);
    return ApiResponse.success(
      res,
      result,
      "Users status changed successfully"
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

module.exports = { getUser, updateUser, getAllUser, toggleUserAccountStatus };
