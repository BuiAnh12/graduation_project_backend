const mongoose = require("mongoose");

const validateMongoDbId = (paramName) => (req, res, next) => {
  const id = req.params[paramName] || req.body[paramName] || req.query[paramName] || req.user;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return next(`Invalid or missing ${paramName}`);
  }

  req.validatedId = id;
  next();
};

module.exports = validateMongoDbId;
