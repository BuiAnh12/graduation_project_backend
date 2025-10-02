const SystemCategory = require("../models/system_categories.model");
const ErrorCode = require("../constants/errorCodes.enum");

const getAllSystemCategory = async () => {
  return await SystemCategory.find().populate("image");
};

const getSystemCategoryById = async (id) => {
  return await SystemCategory.findById(id).select("name image").populate("image");
};

const createSystemCategory = async ({ name, image }) => {
  const exists = await SystemCategory.isNameExists(name);
  if (exists) {
    throw ErrorCode.SYSTEM_CATEGORY_ALREADY_EXISTS;
  }

  return await SystemCategory.create({ name, image });
};

const updateSystemCategory = async (id, payload) => {
  return await SystemCategory.findByIdAndUpdate(id, payload, { new: true });
};

const deleteSystemCategory = async (id) => {
  return await SystemCategory.findByIdAndDelete(id);
};

module.exports = {
  getAllSystemCategory,
  getSystemCategoryById,
  createSystemCategory,
  updateSystemCategory,
  deleteSystemCategory,
};
