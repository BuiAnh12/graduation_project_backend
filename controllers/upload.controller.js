const {
  uploadAvatarImageService,
  uploadImagesService,
  deleteFileFromS3Service,
  uploadAvatarShipperImageService,
} = require("../services/upload.service");
const ApiResponse = require("../utils/apiResponse");

const uploadAvatarImage = async (req, res) => {
  const userId = req?.user?._id;
  try {
    const avatar = await uploadAvatarImageService({
      userId,
      file: req.file,
    });
    return ApiResponse.success(
      res,
      avatar,
      "Avatar uploaded successfully",
      201
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const uploadShipperAvatarImage = async (req, res) => {
  const userId = req?.user?._id;
  try {
    const avatar = await uploadAvatarShipperImageService({
      userId,
      file: req.file,
    });
    return ApiResponse.success(
      res,
      avatar,
      "Avatar uploaded successfully",
      201
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const uploadImages = async (req, res) => {
  try {
    const images = await uploadImagesService(req.files);
    return ApiResponse.success(
      res,
      images,
      "Images uploaded successfully",
      201
    );
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

const deleteFile = async (req, res) => {
  try {
    const result = await deleteFileFromS3Service(req.body.filePath);
    return ApiResponse.success(res, result, "File deleted successfully", 200);
  } catch (error) {
    return ApiResponse.error(res, error, error.message);
  }
};

module.exports = {
  uploadAvatarImage,
  uploadImages,
  deleteFile,
  uploadShipperAvatarImage,
};
