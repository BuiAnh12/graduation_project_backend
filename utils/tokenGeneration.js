const jwt = require("jsonwebtoken");

const generateAccessToken = (payload) => {
  // payload có thể chứa accountId, entity, role...
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
