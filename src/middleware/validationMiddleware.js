import { validationResult } from "express-validator";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    error: "Validation failed",
    details: errors.array().map((item) => ({
      field: item.path,
      message: item.msg
    }))
  });
};
