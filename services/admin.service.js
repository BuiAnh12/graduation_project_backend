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

    const account = await Account.create({
      username,
      password,
      isGoogleLogin: false,
      blocked: false,
      // gán role
      roleGroup: "ADMIN",
      role,
    });

    const admin = await Admin.create({
      acountId: account._id,
      name,
      email,
      phonenumber,
      gender,
    });

    return admin;
  }

  async getAll() {
    return await Admin.find().populate("accounts");
  }

  async getById(id) {
    const admin = await Admin.findById(id).populate("accounts");
    if (!admin) {
      throw new Error("Admin not found");
    }
    return admin;
  }

  async edit(id, { name, email, phonenumber, gender, role, blocked }) {
    const admin = await Admin.findById(id);
    if (!admin) {
      throw new Error("Admin not found");
    }

    // check email mới trùng không
    if (email && email !== admin.email) {
      const existEmail = await Admin.findOne({ email });
      if (existEmail) {
        throw new Error("Email already exists");
      }
      admin.email = email;
    }

    // update thông tin admin
    if (name) admin.name = name;
    if (phonenumber) admin.phonenumber = phonenumber;
    if (gender) admin.gender = gender;

    await admin.save();

    // update account liên quan (role, blocked)
    const account = await Account.findById(admin.acountId);
    if (role) account.role = role;
    if (blocked !== undefined) account.blocked = blocked;
    await account.save();

    return await Admin.findById(id).populate("accounts");
  }

  async delete(id) {
    const admin = await Admin.findById(id);
    if (!admin) {
      throw new Error("Admin not found");
    }

    // xóa account
    await Account.findByIdAndDelete(admin.acountId);

    // xóa admin
    await Admin.findByIdAndDelete(id);

    return { message: "Admin and related account deleted successfully" };
  }
}

module.exports = new AdminService();
