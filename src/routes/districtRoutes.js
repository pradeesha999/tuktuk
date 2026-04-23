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
 *     responses:
 *       200:
 *         description: District list
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
