const User = require("../models/users.model");
const jwt = require("jsonwebtoken");
const createError = require("../utils/createError");

const authMiddleware = async (req, res, next) => {
  let token;
  if (req?.headers?.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user = await User.findById(decoded?.id);

        req.user = user;
        if (!user) {
          return next(createError(401, "User not found"));
        }

        next();
      }
    } catch (error) {
      next(createError(401, "Not authorized token expired, Please login again!"));
    }
  } else {
    next(createError(401, "There is no token attached to header"));
  }
};

module.exports = authMiddleware;
