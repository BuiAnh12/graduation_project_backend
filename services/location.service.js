const Location = require("../models/locations.model");
const ErrorCode = require("../constants/errorCodes.enum");

const addLocationService = async (userId, data) => {
  if (!userId) throw ErrorCode.LOCATION_USER_REQUIRED;

  const { type } = data;

  // Check for duplicate home/company location
  if (["home", "company"].includes(type)) {
    const existing = await Location.findOne({ userId, type });
    if (existing) throw ErrorCode.LOCATION_DUPLICATE_TYPE;
  }

  const newLocation = await Location.create({
    ...data,
    userId,
  });

  return newLocation;
};

const getLocationService = async (id) => {
  const location = await Location.findById(id);
  if (!location) throw ErrorCode.LOCATION_NOT_FOUND;
  return location;
};

const getUserLocationsService = async (userId) => {
  if (!userId) throw ErrorCode.LOCATION_USER_REQUIRED;
  const locations = await Location.find({ userId });
  return locations;
};

const updateLocationService = async (id, updateData) => {
  const existing = await Location.findById(id);
  if (!existing) throw ErrorCode.LOCATION_NOT_FOUND;

  const updated = await Location.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
  return updated;
};

const deleteLocationService = async (id) => {
  const existing = await Location.findById(id);
  if (!existing) throw ErrorCode.LOCATION_NOT_FOUND;

  await Location.findByIdAndDelete(id);
  return true;
};

module.exports = {
  addLocationService,
  getLocationService,
  getUserLocationsService,
  updateLocationService,
  deleteLocationService,
};
