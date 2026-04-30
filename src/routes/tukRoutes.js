// Tuk routes: maps API endpoints to controller actions.
import express from "express";
import {
  createTukTuk,
  getTukTuks,
  getTukById,
  getTukLastLocation,
  getTuksCurrentArea,
  updateTuk,
  deleteTuk
} from "../controllers/tukController.js";
import { applyScope, authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { tukCreateValidator, tukUpdateValidator } from "../validators/resourceValidators.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Tuk
 *     description: Tuk management and live location
 */
/**
 * @swagger
 * /tuk:
 *   post:
 *     tags: [Tuk]
 *     summary: Create tuk
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [registrationNumber, deviceId, district]
 *             properties:
 *               registrationNumber:
 *                 type: string
 *                 example: WP-1234
 *               deviceId:
 *                 type: string
 *                 example: device-0001
 *               ownerName:
 *                 type: string
 *                 example: Jane
 *               district:
 *                 type: string
 *                 example: 64f1f1f1f1f1f1f1f1f1f1f1
 *               policeStation:
 *                 type: string
 *                 example: 64f2f2f2f2f2f2f2f2f2f2f2
 *     responses:
 *       201:
 *         description: Tuk created
 *   get:
 *     tags: [Tuk]
 *     summary: List tuks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *       - in: query
 *         name: provinceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tuk list
 */
/**
 * @swagger
 * /tuk/{id}:
 *   get:
 *     tags: [Tuk]
 *     summary: Get tuk by id
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
 *         description: Tuk found
 *   put:
 *     tags: [Tuk]
 *     summary: Update tuk
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
 *               registrationNumber:
 *                 type: string
 *                 example: WP-1234
 *               deviceId:
 *                 type: string
 *                 example: device-0001
 *               ownerName:
 *                 type: string
 *                 example: Jane
 *               district:
 *                 type: string
 *                 example: 64f1f1f1f1f1f1f1f1f1f1f1
 *               policeStation:
 *                 type: string
 *                 example: 64f2f2f2f2f2f2f2f2f2f2f2
 *     responses:
 *       200:
 *         description: Tuk updated
 *   delete:
 *     tags: [Tuk]
 *     summary: Delete tuk
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
 *         description: Tuk deleted
 */
/**
 * @swagger
 * /tuk/current-area:
 *   get:
 *     tags: [Tuk]
 *     summary: Get latest resolved district/province per tuk
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provinceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current resolved area list
 */
/**
 * @swagger
 * /tuk/{id}/last-location:
 *   get:
 *     tags: [Tuk]
 *     summary: Get last known location of a tuk
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
 *         description: Last location returned
 */
router.use(authenticateToken);

router.post("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("tuk", "write"), tukCreateValidator, validateRequest, createTukTuk);
router.get("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("tuk", "list"), getTukTuks);
router.get("/current-area", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getTuksCurrentArea);
router.get("/:id/last-location", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getTukLastLocation);
router.get("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getTukById);
router.put("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("tuk", "write"), tukUpdateValidator, validateRequest, updateTuk);
router.delete("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), deleteTuk);

export default router;
