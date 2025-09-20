const Account = require("../models/accounts.model");
const Admin = require("../models/admin.model");

class AdminService {
  async createAccount({
    username,
    password,
    name,
    email,
    phonenumber,
    gender,
    role,
  }) {
    const existAccount = await Account.findOne({ username });
    if (existAccount) {
      throw new Error("Username already exists");
    }

    const existEmail = await Admin.findOne({ email });
    if (existEmail) {
      throw new Error("Email already exists");
    }

    // hash password
    // const hashedPassword = await bcrypt.hash(password, 10);

    // tạo account trước
    const account = await Account.create({
      username,
      password,
      isGoogleLogin: false,
      blocked: false,
      // gán role
      roleGroup: "ADMIN",
      role, // ví dụ: "HR_MANAGER", "SUPER_ADMIN"
    });

    // tạo admin profile
    const admin = await Admin.create({
      acountId: account._id,
      name,
      email,
      phonenumber,
      gender,
    });

    return admin;
  }
}

module.exports = new AdminService();
