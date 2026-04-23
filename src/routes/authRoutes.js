import express from "express";
import { login } from "../controllers/authController.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { loginValidator } from "../validators/authValidators.js";

const router = express.Router();

router.post("/login", loginValidator, validateRequest, login);

export default router;
