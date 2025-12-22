const {
  getAllReasonService,
  createReasonService,
  updateReasonService,
  deleteReasonService,
  getAllReportService,
  getReportByIdService,
  createReportService,
  updateReportStatusService,
  deleteReportService,
} = require("../services/report.service");

const ApiResponse = require("../utils/apiResponse");

// REASON
const getAllReason = async (req, res) => {
  try {
    const data = await getAllReasonService();
    return ApiResponse.success(res, data, "Lấy danh sách phí ship thành công");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const createReason = async (req, res) => {
  try {
    const data = await createReasonService(req.body);
    return ApiResponse.success(res, data, "Tạo lý do mới thành công", 201);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const updateReason = async (req, res) => {
  try {
    const data = await updateReasonService(req.params.reasonId, req.body);
    return ApiResponse.success(res, data, "Cập nhật lý do thành công");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const deleteReason = async (req, res) => {
  try {
    await deleteReasonService(req.params.reasonId);
    return ApiResponse.success(res, null, "Xóa lý do thành công");
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};
// REPORT
const getAllReport = async (req, res) => {
  try {
    const { reports, meta } = await getAllReportService(req.query);
    return ApiResponse.success(
      res,
      reports,
      "Báo cáo được tạo thành công",
      200,
      meta
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const getReportById = async (req, res) => {
  try {
    const { report_id } = req.params;
    const data = await getReportByIdService(report_id);
    return ApiResponse.success(res, data, "Báo cáo được lấy thành công");
  } catch (err) {
    return ApiResponse.error(res, err);
  }
};

const createReport = async (req, res) => {
  try {
    const data = await createReportService(req.user?._id, req.body);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const updateReportStatus = async (req, res) => {
  try {
    const data = await updateReportStatusService(req.params.reportId, req.body);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

const deleteReport = async (req, res) => {
  try {
    const data = await deleteReportService(req.params.reportId);
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error);
  }
};

module.exports = {
  getAllReason,
  createReason,
  updateReason,
  deleteReason,
  getAllReport,
  getReportById,
  createReport,
  updateReportStatus,
  deleteReport,
};
