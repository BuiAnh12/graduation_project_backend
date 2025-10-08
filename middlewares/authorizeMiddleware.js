const createError = require("../utils/createError");

/**
 * authorizeMiddleware({
 *   admin: ["manager", "super_admin"],
 *   staff: ["owner", "manager"],
 *   user: true // hoặc [] nếu không có role
 * })
 */
const authorizeMiddleware = (allowed = {}) => {
  return (req, res, next) => {
    if (!req.user || !req.userType) {
      return next(createError(401, "Not authenticated"));
    }

    const { userType, user } = req;

    // Nếu loại user không nằm trong danh sách cho phép
    if (!Object.keys(allowed).includes(userType)) {
      return next(createError(403, `Access denied for user type: ${userType}`));
    }

    const allowedRoles = allowed[userType];

    // Nếu allowed[userType] là true hoặc mảng rỗng → bỏ qua role check
    if (
      allowedRoles === true ||
      !Array.isArray(allowedRoles) ||
      allowedRoles.length === 0
    ) {
      return next();
    }

    // Nếu có danh sách role cụ thể
    if (Array.isArray(user.role)) {
      const hasRole = user.role.some((r) => allowedRoles.includes(r));
      if (!hasRole) {
        return next(
          createError(
            403,
            `Access denied for roles: ${user.role} (${userType})`
          )
        );
      }
    } else {
      if (!allowedRoles.includes(user.role)) {
        return next(
          createError(403, `Access denied for role: ${user.role} (${userType})`)
        );
      }
    }

    next();
  };
};

module.exports = authorizeMiddleware;
