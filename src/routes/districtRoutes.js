// District routes: maps API endpoints to controller actions.
import express from "express";
import {
  createDistrict,
  getDistricts,
  getDistrictById,
  updateDistrict,
  deleteDistrict
} from "../controllers/districtController.js";
import { applyScope, authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { districtCreateValidator, districtUpdateValidator } from "../validators/resourceValidators.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: District
 *     description: District management
 */
/**
 * @swagger
 * /district:
 *   post:
 *     tags: [District]
 *     summary: Create district
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code, province]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Colombo
 *               code:
 *                 type: string
 *                 example: CMB
 *               province:
 *                 type: string
 *                 example: 64f0f0f0f0f0f0f0f0f0f0f0
 *     responses:
 *       201:
 *         description: District created
 *   get:
 *     tags: [District]
 *     summary: List districts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provinceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: "Comma-separated fields, prefix with `-` for descending. Allowed: name, code, createdAt, updatedAt."
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           minimum: 0
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *     responses:
 *       200:
 *         description: District list (X-Total-Count + Link headers; supports If-None-Match for 304 Not Modified)
 */
/**
 * @swagger
 * /district/{id}:
 *   get:
 *     tags: [District]
 *     summary: Get district by id
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
 *         description: District found
 *   put:
 *     tags: [District]
 *     summary: Update district
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
 *                 example: Colombo
 *               code:
 *                 type: string
 *                 example: CMB
 *               province:
 *                 type: string
 *                 example: 64f0f0f0f0f0f0f0f0f0f0f0
 *     responses:
 *       200:
 *         description: District updated
 *   delete:
 *     tags: [District]
 *     summary: Delete district
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
 *         description: District deleted
 */
router.use(authenticateToken);

router.post("/", authorizeRoles("HQ_ADMIN"), districtCreateValidator, validateRequest, createDistrict);
router.get("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("district", "list"), getDistricts);
router.get("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getDistrictById);
router.put("/:id", authorizeRoles("HQ_ADMIN"), districtUpdateValidator, validateRequest, updateDistrict);
router.delete("/:id", authorizeRoles("HQ_ADMIN"), deleteDistrict);

export default router;
