import { body } from "express-validator";

export const loginValidator = [
  body("username").isString().trim().notEmpty(),
  body("password").isString().notEmpty()
];
