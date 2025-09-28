const {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getMetadata,
} = require("firebase/storage");
const ErrorCode = require("../constants/errorCodes.enum");
const User = require("../models/users.model");
const Image = require("../models/images.model");
const asyncHandler = require("express-async-handler");

const uploadFile = asyncHandler(async (file, folderName) => {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const modifiedFileName =
    folderName + "/" + uniqueSuffix + "-" + file.originalname;

  const storage = getStorage();
  const storageRef = ref(storage, modifiedFileName);
  const metadata = { contentType: file.mimetype };

  // Upload file lên Firebase Storage
  await uploadBytes(storageRef, file.buffer, metadata);

  // Lấy URL tải xuống
  const downloadURL = await getDownloadURL(storageRef);

  return {
    filePath: modifiedFileName,
    url: downloadURL,
    createdAt: Date.now(),
  };
});

const uploadAvatarImageService = asyncHandler(async ({ userId, file }) => {
  if (!file) {
    throw ErrorCode.FILE_NOT_FOUND;
  }

  // Upload file lên Firebase
  const uploadedImage = await uploadFile(file, "avatars");

  // Lưu metadata ảnh vào DB
  const newImage = await Image.create({
    file_path: uploadedImage.filePath,
    url: uploadedImage.url,
  });

  // Gán _id của ảnh cho user
  const updateUser = await User.findByIdAndUpdate(
    userId,
    {
      avatarImage: newImage._id,
    },
    { new: true }
  ).populate("avatarImage", "url file_path"); // populate để trả cả url

  if (!updateUser) {
    throw ErrorCode.USER_NOT_FOUND;
  }

  return updateUser;
});

const uploadImagesService = asyncHandler(async (files) => {
  if (!files || files.length === 0) {
    throw ErrorCode.NO_FILES_UPLOADED;
  }

  const uploadedFileDetails = []; // Lưu trữ thông tin chi tiết các file đã upload

  // Upload từng file và lấy thông tin
  await Promise.all(
    files.map(async (file) => {
      const uploadedFile = await uploadFile(file, "images");
      uploadedFileDetails.push(uploadedFile);
    })
  );

  return uploadedFileDetails;
});
const deleteFileFromFirebaseService = async (filePath) => {
  if (!filePath) throw ErrorCode.MISSING_REQUIRED_FIELDS;
  const storage = getStorage();
  const decodedFilePath = decodeURIComponent(filePath);
  const fileRef = ref(storage, decodedFilePath);
  try {
    await getMetadata(fileRef);
    await deleteObject(fileRef);
    return { message: "File deleted successfully" };
  } catch (error) {
    if (error.code === "storage/object-not-found") {
      throw ErrorCode.FILE_NOT_FOUND;
    }
    throw ErrorCode.FILE_DELETE_FAILED;
  }
};
module.exports = {
  uploadAvatarImageService,
  uploadImagesService,
  deleteFileFromFirebaseService,
};
