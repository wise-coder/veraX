const notFound = (req, _res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (error, _req, res, _next) => {
  let statusCode = error.statusCode || res.statusCode || 500;

  if (error.name === "CastError") {
    statusCode = 400;
    error.message = "Invalid resource id";
  }

  if (error.name === "ValidationError") {
    statusCode = 400;
    error.message = Object.values(error.errors).map((item) => item.message).join(", ");
  }

  if (error.code === 11000) {
    statusCode = 400;
    error.message = `${Object.keys(error.keyValue || {}).join(", ")} already exists`;
  }

  const normalizedStatus = statusCode === 200 ? 500 : statusCode;
  const safeMessage = normalizedStatus >= 500 ? "Something went wrong" : (error.message || "Request failed");

  if (normalizedStatus >= 500) {
    console.error(error);
  }

  res.status(normalizedStatus).json({
    success: false,
    message: safeMessage,
  });
};

module.exports = { notFound, errorHandler };
