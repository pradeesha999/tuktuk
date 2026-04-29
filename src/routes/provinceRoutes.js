// Province routes: maps API endpoints to controller actions.
import express from "express";
import {
  createProvince,
  getProvinces,
  getProvinceById,
  updateProvince,
  deleteProvince
} from "../controllers/provinceController.js";
import { authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { provinceCreateValidator, provinceUpdateValidator } from "../validators/resourceValidators.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Province
 *     description: Province management
 */
/**
 * @swagger
 * /province:
 *   post:
 *     tags: [Province]
 *     summary: Create province
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Western
 *               code:
 *                 type: string
 *                 example: WP
 *     responses:
 *       201:
 *         description: Province created
 *   get:
 *     tags: [Province]
 *     summary: List provinces
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Province list
 */
/**
 * @swagger
 * /province/{id}:
 *   get:
 *     tags: [Province]
 *     summary: Get province by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Province found
 *   put:
 *     tags: [Province]
 *     summary: Update province
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Western
 *               code:
 *                 type: string
 *                 example: WP
 *     responses:
 *       200:
 *         description: Province updated
 *   delete:
 *     tags: [Province]
 *     summary: Delete province
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Province deleted
 */
router.use(authenticateToken);

router.post("/", authorizeRoles("HQ_ADMIN"), provinceCreateValidator, validateRequest, createProvince);
router.get("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getProvinces);
router.get("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getProvinceById);
router.put("/:id", authorizeRoles("HQ_ADMIN"), provinceUpdateValidator, validateRequest, updateProvince);
router.delete("/:id", authorizeRoles("HQ_ADMIN"), deleteProvince);

export default router;
