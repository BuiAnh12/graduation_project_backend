const asyncHandler = require("express-async-handler");
const { loginService } = require("../services/auth.service");

const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const { getRole, getStore } = req.query;

  const { response, refreshToken } = await loginService({
    email,
    password,
    getRole,
    getStore,
  });

  // set cookie for refresh token
  res.cookie("refreshToken", refreshToken, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  });

  res.status(200).json(response);
});

module.exports = {
  login,
};
