const { s3 } = require("../config/s3_connection");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const ErrorCode = require("../constants/errorCodes.enum");
const User = require("../models/users.model");
const Shipper = require("../models/shippers.model");
const Image = require("../models/images.model");
const asyncHandler = require("express-async-handler");

const BUCKET_NAME = process.env.BUCKET_NAME;

// Upload single file to S3
const uploadFile = asyncHandler(async (file, folderName) => {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const fileName = `${folderName}/${uniqueSuffix}-${file.originalname}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3.send(command);

  // Public URL if your bucket policy allows
  const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

  return {
    filePath: fileName,
    url: fileUrl,
    createdAt: Date.now(),
  };
});

// Avatar upload service
const uploadAvatarImageService = asyncHandler(async ({ userId, file }) => {
  if (!file) throw ErrorCode.FILE_NOT_FOUND;

  const uploadedImage = await uploadFile(file, "avatars");

  const newImage = await Image.create({
    file_path: uploadedImage.filePath,
    url: uploadedImage.url,
  });

  const updateUser = await User.findByIdAndUpdate(
    userId,
    { avatarImage: newImage._id },
    { new: true }
  ).populate("avatarImage", "url file_path");

  if (!updateUser) throw ErrorCode.USER_NOT_FOUND;

  return updateUser;
});

const uploadAvatarShipperImageService = asyncHandler(
  async ({ userId, file }) => {
    if (!file) throw ErrorCode.FILE_NOT_FOUND;

    const uploadedImage = await uploadFile(file, "avatars");

    const newImage = await Image.create({
      file_path: uploadedImage.filePath,
      url: uploadedImage.url,
    });

    const updateUser = await Shipper.findByIdAndUpdate(
      userId,
      { avatarImage: newImage._id },
      { new: true }
    ).populate("avatarImage", "url file_path");

    if (!updateUser) throw ErrorCode.SHIPPER_NOT_FOUND;

    return updateUser;
  }
);

// Multiple files
const uploadImagesService = asyncHandler(async (files) => {
  if (!files || files.length === 0) throw ErrorCode.NO_FILES_UPLOADED;

  const uploadedFileDetails = [];

  await Promise.all(
    files.map(async (file) => {
      // Upload lên Firebase
      const uploadedFile = await uploadFile(file, "images");

      // Lưu DB để lấy imageId
      const savedImage = await Image.create({
        file_path: uploadedFile.filePath,
        url: uploadedFile.url,
      });

      uploadedFileDetails.push(savedImage);
    })
  );

  return uploadedFileDetails;
});

// Delete file
const deleteFileFromS3Service = async (filePath) => {
  if (!filePath) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filePath,
  });

  try {
    await s3.send(command);
    return { message: "File deleted successfully" };
  } catch (error) {
    throw ErrorCode.FILE_DELETE_FAILED;
  }
};

module.exports = {
  uploadAvatarImageService,
  uploadImagesService,
  deleteFileFromS3Service,
  uploadAvatarShipperImageService,
};
