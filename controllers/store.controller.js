const {
  registerStoreService,
  getAllStoreService,
  getStoreInformationService,
  getAllDishInStoreService,
  getDetailDishService,
  checkStoreStatusService,
  getStoreInfoService,
  toggleOpenStatusService,
  updateOpenCloseHoursService,
  updateStoreAddressService,
  updateStorePaperWorkService,
  updateStoreInfoService,
  updateStoreImagesService,
} = require("../services/store.service");
const ApiResponse = require("../utils/apiResponse");

const registerStore = async (req, res) => {
  try {
    const store = await registerStoreService(req.body || {});

    return ApiResponse.success(res, store, "Store register successfully", 200);
  } catch (error) {
    console.error("Register Store Error:", error);
    return ApiResponse.error(res, error, error.message || "Register failed");
  }
};
const getAllStore = async (req, res) => {
  try {
    const stores = await getAllStoreService(req.query);
    return ApiResponse.success(res, stores, "Stores fetched successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getStoreInformation = async (req, res) => {
  try {
    const store = await getStoreInformationService(req.params.storeId);
    return ApiResponse.success(
      res,
      store,
      "Store information fetched successfully"
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getAllDishInStore = async (req, res) => {
  try {
    const dishes = await getAllDishInStoreService(req.params.storeId);
    return ApiResponse.success(res, dishes, "Dishes fetched successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getDetailDish = async (req, res) => {
  try {
    const dish = await getDetailDishService(req.params.dishId);
    return ApiResponse.success(res, dish, "Dish details fetched successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const checkStoreStatus = async (req, res) => {
  try {
    const result = await checkStoreStatusService(req.params.storeId);
    return ApiResponse.success(res, result, "Store is approved");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getStoreDetailInfo = async (req, res) => {
  try {
    const store = await getStoreInfoService(req.params.storeId);
    return ApiResponse.success(res, store, "Store founded");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const toggleStoreOpenStatus = async (req, res) => {
  try {
    const store = await toggleOpenStatusService(
      req.params.storeId,
      req.user?._id
    );
    return ApiResponse.success(res, store, "Toggle open/closed successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateOpenCloseHours = async (req, res) => {
  try {
    const store = await updateOpenCloseHoursService(
      req.params.storeId,
      req.user?._id,
      req.body
    );
    return ApiResponse.success(res, store, "Change hours successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateStoreInfo = async (req, res) => {
  try {
    const store = await updateStoreInfoService(
      req.params.storeId,
      req.user?._id,
      req.body
    );
    return ApiResponse.success(res, store, "Change info successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateStoreImages = async (req, res) => {
  try {
    const store = await updateStoreImagesService(
      req.params.storeId,
      req.user?._id,
      req.body
    );
    return ApiResponse.success(res, store, "Change images successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateStoreAddress = async (req, res) => {
  try {
    const store = await updateStoreAddressService(
      req.params.storeId,
      req.user?._id,
      req.body
    );
    return ApiResponse.success(res, store, "Change address successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const updateStorePaperWork = async (req, res) => {
  try {
    const store = await updateStorePaperWorkService(
      req.params.storeId,
      req.user?._id,
      req.body
    );
    return ApiResponse.success(res, store, "Change paperworks successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

module.exports = {
  registerStore,
  getAllStore,
  getStoreInformation,
  getAllDishInStore,
  getDetailDish,
  checkStoreStatus,
  getStoreDetailInfo,
  toggleStoreOpenStatus,
  updateOpenCloseHours,
  updateStoreInfo,
  updateStoreImages,
  updateStoreAddress,
  updateStorePaperWork,
};
