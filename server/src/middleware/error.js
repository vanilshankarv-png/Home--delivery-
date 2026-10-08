export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode
    || error.status
    || (error.code === 11000 ? 409 : undefined)
    || (error.name === "ValidationError" ? 400 : undefined)
    || (error.name === "CastError" ? 400 : undefined)
    || (error.name === "MulterError" ? (error.code === "LIMIT_FILE_SIZE" ? 413 : 400) : 500);
  if (statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    message: statusCode >= 500
      ? "Internal server error"
      : error.code === 11000
        ? "An account with this email already exists."
        : error.message
  });
}
