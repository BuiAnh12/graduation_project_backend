const Staff = require("../models/staffs.model");
const Account = require("../models/accounts.model");
const ErrorCode = require("../constants/errorCodes.enum");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const getProfileService = async (staffId) => {
  if (!staffId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const staff = await Staff.findById(staffId)
    .populate({ path: "accountId" })
    .populate({ path: "avatarImage" });

  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;

  return staff;
};

const updateProfileService = async (staffId, payload) => {
  if (!staffId) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const staff = await Staff.findById(staffId);
  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;

  // Nếu có email mới thì kiểm tra trùng
  if (payload.email && payload.email !== staff.email) {
    const existedEmail = await Staff.findOne({ email: payload.email });
    if (existedEmail) throw ErrorCode.EMAIL_EXISTS;
  }

  // Cập nhật thông tin
  if (payload.name) staff.name = payload.name;
  if (payload.email) staff.email = payload.email;
  if (payload.phonenumber) staff.phonenumber = payload.phonenumber;
  if (payload.gender) staff.gender = payload.gender;
  if (payload.avatarImage) staff.avatarImage = payload.avatarImage;

  await staff.save();

  // populate lại để trả về dữ liệu đầy đủ
  const updatedStaff = await Staff.findById(staff._id)
    .populate({ path: "accountId" })
    .populate({ path: "avatarImage" });

  return updatedStaff;
};

const checkCurrentPasswordService = async (staffId, currentPassword) => {
  if (!staffId || !currentPassword) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const staff = await Staff.findById(staffId).populate("accountId");
  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;

  const account = await Account.findById(staff.accountId).select("+password");
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  // 2️⃣ Gọi hàm isPasswordMatched y như loginService
  const isMatch =
    typeof account.isPasswordMatched === "function"
      ? await account.isPasswordMatched(currentPassword)
      : false;

  // 3️⃣ Trả về true/false
  return isMatch;
};

const updatePasswordService = async (staffId, { newPassword }) => {
  if (!staffId || !newPassword) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const staff = await Staff.findById(staffId);
  if (!staff) throw ErrorCode.STAFF_NOT_FOUND;

  const account = await Account.findById(staff.accountId);
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  account.password = newPassword;
  await account.save();

  return { success: true, message: "Cập nhật mật khẩu thành công" };
};

const forgotPasswordService = async ({ email }) => {
  const user = await Staff.findOne({ email });
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

  const staff = await Staff.findOne({ email }).populate("accountId");
  if (!staff) throw ErrorCode.ACCOUNT_NOT_FOUND;

  if (!staff.otp || !staff.otpExpires) throw ErrorCode.INVALID_OTP;

  if (Date.now() > staff.otpExpires) throw ErrorCode.OTP_EXPIRED;

  // Hash OTP đầu vào để so sánh với DB
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  if (hashedOtp !== staff.otp) throw ErrorCode.INVALID_OTP;

  return { success: true, message: "OTP hợp lệ" };
};

// 2️⃣ Reset mật khẩu bằng email (sau khi OTP hợp lệ)
const resetPasswordWithEmailService = async ({ email, newPassword }) => {
  if (!email || !newPassword) throw ErrorCode.MISSING_REQUIRED_FIELDS;

  const staff = await Staff.findOne({ email });
  if (!staff) throw ErrorCode.ACCOUNT_NOT_FOUND;

  const account = await Account.findById(staff.accountId);
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  account.password = newPassword;
  await account.save();

  // Xóa OTP sau khi reset thành công
  staff.otp = null;
  staff.otpExpires = null;
  await staff.save();

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
