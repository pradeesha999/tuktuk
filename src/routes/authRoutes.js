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
/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user (HQ admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password, role]
 *             properties:
 *               username:
 *                 type: string
 *                 example: station.ops
 *               password:
 *                 type: string
 *                 example: StrongPass123!
 *               role:
 *                 type: string
 *                 enum: [PROVINCE_ADMIN, DISTRICT_OFFICER, STATION_OFFICER, DEVICE]
 *               provinceId:
 *                 type: string
 *                 example: 64f0f0f0f0f0f0f0f0f0f0f0
 *               districtId:
 *                 type: string
 *                 example: 64f1f1f1f1f1f1f1f1f1f1f1
 *               stationId:
 *                 type: string
 *                 example: 64f2f2f2f2f2f2f2f2f2f2f2
 *               tukId:
 *                 type: string
 *                 example: 64f3f3f3f3f3f3f3f3f3f3f3
 *     responses:
 *       201:
 *         description: User registered
 *       403:
 *         description: Forbidden (non-HQ role)
 */
router.post("/register", authenticateToken, authorizeRoles("HQ_ADMIN"), registerValidator, validateRequest, register);

export default router;
