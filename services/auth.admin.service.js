const Admin = require("../models/admin.model");
const Account = require("../models/accounts.model");
const ErrorCode = require("../constants/errorCodes.enum");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const getProfileService = async (adminId) => {
  console.log(adminId);
  if (!adminId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  // 1. Tìm admin theo id, populate account và avatarImage
  const admin = await Admin.findById(adminId)
    .populate({ path: "accountId" }) // populate thật, không phải virtual
    .populate({ path: "avatarImage" }); // populate ảnh

  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  return admin;
};

const updateProfileService = async (adminId, payload) => {
  if (!adminId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const admin = await Admin.findById(adminId);
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  // Nếu có email mới thì kiểm tra trùng
  if (payload.email && payload.email !== admin.email) {
    const existedEmail = await Admin.findOne({ email: payload.email });
    if (existedEmail) throw ErrorCode.EMAIL_EXISTS;
  }

  // Cập nhật thông tin
  if (payload.name) admin.name = payload.name;
  if (payload.email) admin.email = payload.email;
  if (payload.phonenumber) admin.phonenumber = payload.phonenumber;
  if (payload.gender) admin.gender = payload.gender;
  if (payload.avatarImage) admin.avatarImage = payload.avatarImage;

  await admin.save();

  // populate lại để trả về dữ liệu đầy đủ
  const updatedAdmin = await Admin.findById(admin._id)
    .populate({ path: "accountId" })
    .populate({ path: "avatarImage" });

  return updatedAdmin;
};

const checkCurrentPasswordService = async (adminId, currentPassword) => {
  if (!adminId || !currentPassword) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  // 1️⃣ Lấy admin và populate account
  const admin = await Admin.findById(adminId).populate("accountId");
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  const account = await Account.findById(admin.accountId).select("+password");
  console.log("Account", account);
  console.log("Current password", currentPassword);
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  // 2️⃣ Gọi hàm isPasswordMatched y như loginService
  const isMatch =
    typeof account.isPasswordMatched === "function"
      ? await account.isPasswordMatched(currentPassword)
      : false;

  // 3️⃣ Trả về true/false
  return isMatch;
};

const updatePasswordService = async (adminId, { newPassword }) => {
  if (!adminId || !newPassword) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const admin = await Admin.findById(adminId);
  if (!admin) throw ErrorCode.ADMIN_NOT_FOUND;

  const account = await Account.findById(admin.accountId);
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  account.password = newPassword;
  await account.save();

  return { success: true, message: "Cập nhật mật khẩu thành công" };
};

const forgotPasswordService = async ({ email }) => {
  const user = await Admin.findOne({ email });
  if (!user) throw ErrorCode.ACCOUNT_NOT_FOUND;

  const otp = await user.createOtp();
  await user.save();

  const mailBody = `
  <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 30px;">
    <div style="max-width: 500px; margin: auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
      <div style="background-color: #2563eb; padding: 20px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0;">Đặt lại mật khẩu</h2>
      </div>
      <div style="padding: 25px;">
        <p style="font-size: 16px; color: #333;">Xin chào,</p>
        <p style="font-size: 15px; color: #444; line-height: 1.6;">
          Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
          Vui lòng sử dụng mã OTP bên dưới để tiếp tục quá trình:
        </p>
        <div style="text-align: center; margin: 25px 0;">
          <span style="display: inline-block; background-color: #f1f5f9; color: #111827; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px 20px; border-radius: 8px;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 15px; color: #555;">
          Mã OTP này chỉ có hiệu lực trong <strong>2 phút</strong>.  
          Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
        </p>
        <p style="font-size: 14px; color: #888; margin-top: 30px;">Trân trọng,<br>Đội ngũ Hỗ trợ Hệ thống</p>
      </div>
      <div style="background-color: #f9fafb; text-align: center; padding: 12px; font-size: 13px; color: #aaa;">
        &copy; ${new Date().getFullYear()} Your Company. All rights reserved.
      </div>
    </div>
  </div>
`;

  await sendEmail({
    to: email,
    subject: "Quên mật khẩu",
    html: mailBody,
  });

  return { response: { success: true, message: "OTP sent successfully" } };
};

const verifyOtpService = async ({ email, otp }) => {
  if (!email || !otp) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const admin = await Admin.findOne({ email }).populate("accountId");
  if (!admin) throw ErrorCode.ACCOUNT_NOT_FOUND;

  if (!admin.otp || !admin.otpExpires) throw ErrorCode.INVALID_OTP;

  if (Date.now() > admin.otpExpires) throw ErrorCode.OTP_EXPIRED;

  // Hash OTP đầu vào để so sánh với DB
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  console.log("Input OTP (hashed):", hashedOtp);

  if (hashedOtp !== admin.otp) throw ErrorCode.INVALID_OTP;

  return { success: true, message: "OTP hợp lệ" };
};

// 2️⃣ Reset mật khẩu bằng email (sau khi OTP hợp lệ)
const resetPasswordWithEmailService = async ({ email, newPassword }) => {
  if (!email || !newPassword) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const admin = await Admin.findOne({ email });
  if (!admin) throw ErrorCode.ACCOUNT_NOT_FOUND;

  const account = await Account.findById(admin.accountId);
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  account.password = newPassword;
  await account.save();

  // Xóa OTP sau khi reset thành công
  admin.otp = null;
  admin.otpExpires = null;
  await admin.save();

  return { success: true, message: "Mật khẩu đã được đặt lại thành công" };
};

module.exports = {
  getProfileService,
  updateProfileService,
  checkCurrentPasswordService,
  updatePasswordService,
  forgotPasswordService,
  verifyOtpService,
  resetPasswordWithEmailService,
};
