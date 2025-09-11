export const globalErrhandler = (err, req, res, next) => {
  // stack
  // message
  const stack = err?.stack;
  const statusCode = err?.statuscode ? err?.statuscode : 500;
  const message = err?.message;
  res.status(statusCode).json({
    stack,
    message,
  });
};

// Error handling for 404
export const notFound = (req, res, next) => {
  const err = new Error(`Route ${req.originalUrl} not found`);
  next(err); // which resprespent the first argument
};
