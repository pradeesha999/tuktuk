import express from "express";
import { login, register } from "../controllers/authController.js";
import { authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { loginValidator, registerValidator } from "../validators/authValidators.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */
/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive JWT
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authenticated successfully
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", loginValidator, validateRequest, login);
router.post("/register", authenticateToken, authorizeRoles("HQ_ADMIN"), registerValidator, validateRequest, register);

export default router;
