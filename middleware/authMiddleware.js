const Account = require("../models/accounts.model");
const jwt = require("jsonwebtoken");
const createError = require("../utils/createError");

const authMiddleware = async (req, res, next) => {
  let token;

  if (req?.headers?.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Lấy account từ DB
      const user = await Account.findById(decoded.id);
      if (!user) {
        return next(createError(401, "User not found"));
      }

      req.user = {
        id: user._id,
        role: decoded.role,
        username: user.username,
      };

      return next();
    } catch (error) {
      return next(
        createError(401, "Token expired or invalid, please login again")
      );
    }
  }

  return next(createError(401, "No token provided"));
};
module.exports = authMiddleware;
