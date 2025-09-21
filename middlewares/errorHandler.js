// Error Handler
const errorHandler = (err, req, res, next) => {
  console.log("ERROR LOG ", new Date().toLocaleString());
  console.log("Request:", req.method, req.originalUrl);
  console.log("Params:", req.params);
  console.log("Body:", req.body);
  console.log("Query:", req.query);
  console.log("Error:", err);
  console.log("Error stack:", err.stack);

  const errorStatus = err.status || 500;
  const response = {
    status: "Error",
    message: err?.message || "An error occurred",
  };

  return res.status(errorStatus).json(response);
};

module.exports = { errorHandler };
