const User = require("../models/users.model");
const ErrorCode = require("../constants/errorCodes.enum");

const getUserService = async (id) => {
  const user = await User.findById(id).populate({
    path: "avatarImage", select: "_id url"
  })

  if (!user) throw ErrorCode.USER_NOT_FOUND;
  return user;
};

const updateUserService = async (userId, updateData) => {
  const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

  if (!user) throw ErrorCode.USER_NOT_FOUND;
  return user;
};

module.exports = { getUserService, updateUserService };
