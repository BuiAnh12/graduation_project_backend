const jwt = require("jsonwebtoken");
const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const generateAccessAdminToken = (accountId, adminId, role) => {
  return jwt.sign({ accountId, adminId, role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });
};

module.exports = {
  generateAccessAdminToken,
  generateAccessToken,
  generateRefreshToken,
};
