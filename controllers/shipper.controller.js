const {
  getShipperRequestsService,
  approveShipperRequestService,
  getAllShipperService,
  toggleShipperAccountStatusService,
} = require("../services/shipper.service");
const ApiResponse = require("../utils/apiResponse");

const getShipperRequest = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sort = "createdAt_desc",
    } = req.query;

    const { shippers, totalShippers, totalPages, currentPage } =
      await getShipperRequestsService(
        Number(page),
        Number(limit),
        search,
        sort
      );

    return ApiResponse.success(
      res,
      shippers,
      "Get shippers successfully",
      200,
      {
        totalShippers,
        totalPages,
        currentPage,
        limit: Number(limit),
        search,
        sort,
      }
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const approveShipperRequest = async (req, res) => {
  try {
    const shipper = await approveShipperRequestService(req.params.shipperId);
    return ApiResponse.success(res, shipper, "Approve successfully");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const getAllShippers = async (req, res) => {
  try {
    const { shippers, meta } = await getAllShipperService(req.query); // ✅ destructuring
    return ApiResponse.success(
      res,
      shippers,
      "Shippers fetched successfully",
      200,
      meta
    );
  } catch (err) {
    return ApiResponse.error(res, err, err.message);
  }
};

const toggleShipperAccountStatus = async (req, res) => {
  try {
    const result = await toggleShipperAccountStatusService(
      req.params.shipperId
    );
    return ApiResponse.success(
      res,
      result,
      "Shipper status changed successfully"
    );
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

module.exports = {
  getShipperRequest,
  approveShipperRequest,
  getAllShippers,
  toggleShipperAccountStatus,
};
