const asyncHandler = require("express-async-handler");
const createError = require("../utils/createError");
const ApiResponse = require("../utils/apiResponse");

const {
  addLocationService,
  getLocationService,
  getUserLocationsService,
  updateLocationService,
  deleteLocationService,
} = require("../services/location.service");


const addLocation = asyncHandler(async (req, res, next) => {
  const userId = req?.user?._id;

  try {
    const location = await addLocationService(userId, req.body);
    return ApiResponse.success(res, location, "Add location successfully", 201);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
});


const getLocation = asyncHandler(async (req, res, next) => {
  try {
    const location = await getLocationService(req.params.id);
    return ApiResponse.success(res, location, "Get location successfully", 200);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
});


const getUserLocations = asyncHandler(async (req, res, next) => {
  const userId = req?.user?._id;

  try {
    const locations = await getUserLocationsService(userId);
    return ApiResponse.success(res, locations, "Get user locations successfully", 200);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
});


const updateLocation = asyncHandler(async (req, res, next) => {
  try {
    const updated = await updateLocationService(req.params.id, req.body);
    return ApiResponse.success(res, updated, "Update location successfully", 200);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
});


const deleteLocation = asyncHandler(async (req, res, next) => {
  try {
    await deleteLocationService(req.params.id);
    return ApiResponse.success(res, null, "Delete location successfully", 200);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
});

module.exports = {
  addLocation,
  getLocation,
  getUserLocations,
  updateLocation,
  deleteLocation,
};
