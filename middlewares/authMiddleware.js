const jwt = require("jsonwebtoken");
const createError = require("../utils/createError");
const Admin = require("../models/admin.model");
const Staff = require("../models/staffs.model");
const User = require("../models/users.model");

const ENTITY_MODEL = {
  admin: Admin,
  staff: Staff,
  user: User,
};

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer")) {
    return next(createError(401, "No token provided"));
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const Model = ENTITY_MODEL[decoded.entity];
    if (!Model) return next(createError(401, "Invalid entity"));

    const user = await Model.findById(decoded.entityId);
    if (!user) return next(createError(401, "User not found"));

    req.user = user;
    req.userType = decoded.entity;
    req.role = decoded.role;

    next();
  } catch (err) {
    return next(createError(401, "Invalid or expired token"));
  }
};

module.exports = authMiddleware;
