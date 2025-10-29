const ErrorCode = require("../constants/errorCodes.enum");
const axios = require("axios")
const {
    createAccountService,
    getAllAdService,
    getAdminByIdService,
    editAdminService,
    deleteAdminService,
    toggleAdminAccountStatusService,
} = require("../services/admin.service");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("express-async-handler");

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

const forwardPythonError = (
    res,
    error,
    defaultErrorCode = ErrorCode.INTERNAL_SERVER_ERROR
) => {
    console.error("Proxy Error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const errData = error.response?.data;
    // Prefer FastAPI's 'detail' for error message, fallback to others
    const message =
        errData?.detail ||
        errData?.message ||
        "An error occurred with the AI service.";
    let errorCode = defaultErrorCode;

    // Specific error code mapping based on status/message
    if (status === 404 && message.includes("Job ID not found")) {
        errorCode = ErrorCode.NOT_FOUND;
    } else if (status === 409 && message.includes("already running")) {
        errorCode = ErrorCode.OPERATION_LOCKED; // Ensure OPERATION_LOCKED is defined in ErrorCode
    } else if (status === 400 || status === 422) {
        // Bad Request or Unprocessable Entity
        errorCode = ErrorCode.VALIDATION_ERROR; // Or a more specific AI validation error
    } else if (status >= 500) {
        // General server errors from Python
        errorCode = ErrorCode.AI_SERVICE_ERROR; // Define a specific error code for AI service failures
    }

    return res.status(status).json({
        success: false,
        message: message, // Forward the message from Python/Axios
        errorCode: errorCode.code, // Use mapped error code
        errorMessage: errorCode.message, // Use mapped error message
        meta: { status },
    });
};

const proxyToPythonAPI = async (
    method,
    path,
    res,
    successMessage,
    axiosConfig = {},
    errorMappingCode = ErrorCode.AI_OPERATION_FAILED // Define AI_OPERATION_FAILED in ErrorCode
) => {
    try {
        const response = await axios[method](
            `${PYTHON_API_URL}${path}`,
            axiosConfig.data,
            axiosConfig
        ); // Pass data correctly for POST/PUT
        // Forward Python's successful response data structure
        return ApiResponse.success(res, response.data, successMessage);
    } catch (error) {
        // Use the refined error forwarder
        return forwardPythonError(res, error, errorMappingCode);
    }
};

const triggerExport = asyncHandler(async (req, res) => {
    await proxyToPythonAPI(
        "post",
        "/admin/export-data",
        res,
        "Data export triggered successfully."
    );
});

const triggerTrain = asyncHandler(async (req, res) => {
    await proxyToPythonAPI(
        "post",
        "/admin/train-model",
        res,
        "Model training triggered successfully."
    );
});

const reloadModel = asyncHandler(async (req, res) => {
    // We can customize the success message based on Python's response if needed later
    await proxyToPythonAPI(
        "post",
        "/admin/reload-model",
        res,
        "Model reload requested successfully."
    );
});

const getJobStatus = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    if (!jobId) {
        // Keep initial validation here
        return ApiResponse.error(
            res,
            ErrorCode.VALIDATION_ERROR,
            "Job ID is required."
        );
    }
    await proxyToPythonAPI(
        "get",
        `/admin/job-status/${jobId}`,
        res,
        "Status fetched successfully."
    );
});

const createAdmin = async (req, res) => {
    try {
        const admin = await createAccountService(req.body || {});
        return ApiResponse.success(
            res,
            admin,
            "Admin created successfully",
            201
        );
    } catch (error) {
        return ApiResponse.error(res, error);
    }
};

const getAllAdmins = async (req, res) => {
    try {
        const { admin, meta } = await getAllAdService(req.user?._id, req.query);
        return ApiResponse.success(
            res,
            admin,
            "Admin fetched successfully",
            200,
            meta
        );
    } catch (error) {
        return ApiResponse.error(res, error, error.message);
    }
};

const getAdminById = async (req, res) => {
    try {
        const admin = await getAdminByIdService(req.params.id);
        return ApiResponse.success(res, admin, "Get admin by id successfully");
    } catch (error) {
        return ApiResponse.error(res, error);
    }
};

const updateAdmin = async (req, res) => {
    try {
        const admin = await editAdminService(req.params.id, req.body || {});
        return ApiResponse.success(res, admin, "Admin updated successfully");
    } catch (error) {
        return ApiResponse.error(res, error);
    }
};

const deleteAdmin = async (req, res) => {
    try {
        const result = await deleteAdminService(req.params.id);
        return ApiResponse.success(res, result, "Admin deleted successfully");
    } catch (error) {
        return ApiResponse.error(res, error);
    }
};

const toggleAccoutAdminStatus = async (req, res) => {
    try {
        const result = await toggleAdminAccountStatusService(
            req.params.adminId
        );
        return ApiResponse.success(
            res,
            null,
            "Admin change status successfully",
            200
        );
    } catch (error) {
        return ApiResponse.error(res, error, error.message);
    }
};

module.exports = {
    createAdmin,
    getAllAdmins,
    getAdminById,
    updateAdmin,
    deleteAdmin,
    toggleAccoutAdminStatus,
    triggerExport,
    triggerTrain,
    reloadModel,
    getJobStatus,
};
