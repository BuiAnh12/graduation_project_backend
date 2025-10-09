const { getUserService, updateUserService } = require("../services/user.service");
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

module.exports = { getUser, updateUser };
