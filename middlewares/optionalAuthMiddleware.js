const jwt = require("jsonwebtoken");
const createError = require("../utils/createError");
const Admin = require("../models/admin.model");
const Staff = require("../models/staffs.model");
const User = require("../models/users.model");
// Make sure this model is imported so populate() works
const UserReference = require("../models/user_references.model");

const ENTITY_MODEL = {
  admin: Admin,
  staff: Staff,
  user: User,
};

/**
 * Optional Auth Middleware:
 * - If a valid token is provided, it attaches req.user, req.userType, and req.role.
 * - **If the entity is 'user', it also populates and attaches 'userReference'.**
 * - If NO token is provided, it allows the request to proceed (req.user will be undefined).
 * - If an INVALID token is provided, it blocks the request with a 401 error.
 */
const optionalAuthMiddleware = async (req, res, next) => {
  const header = req.headers.authorization; // If no token is present, just proceed

  if (!header?.startsWith("Bearer")) {
    return next();
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const Model = ENTITY_MODEL[decoded.entity];
    if (!Model) return next(createError(401, "Invalid entity"));

    let user;

    if (decoded.entity === "user") {
      user = await Model.findById(decoded.entityId).populate(
        "user_reference_id"
      );
    } else {
      // For Admin or Staff, just find them normally
      user = await Model.findById(decoded.entityId);
    }

    if (!user) return next(createError(401, "User not found"));

    // Attach user info to the request
    req.user = user;
    req.userType = decoded.entity;
    req.role = decoded.role;

    next();
  } catch (err) {
    console.log(err);
    // If a token was provided but is invalid, block the request
    next()
  }
};

module.exports = optionalAuthMiddleware;
