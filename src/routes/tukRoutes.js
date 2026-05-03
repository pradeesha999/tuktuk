// Tuk routes: maps API endpoints to controller actions.
import express from "express";
import {
  createTukTuk,
  getTukTuks,
  getTukById,
  getTukLastLocation,
  getTuksLastPingArea,
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
 *     description: Tuk management and location (last ping / history)
 */
/**
 * @swagger
 * /tuk:
 *   post:
 *     tags: [Tuk]
 *     summary: Create tuk
 *     description: >
 *       Body always requires registrationNumber and deviceId.
 *       STATION_OFFICER may omit district and policeStation: they are set from the JWT stationId
 *       and that station’s district (province follows from the district document).
 *       HQ_ADMIN, PROVINCE_ADMIN, and DISTRICT_OFFICER must send district (and policeStation when binding to a station);
 *       scope middleware may still restrict or normalize ids.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [registrationNumber, deviceId]
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
 *                 description: ObjectId of district. Omit for STATION_OFFICER (injected). Required for other creator roles once scope is applied.
 *                 example: 64f1f1f1f1f1f1f1f1f1f1f1
 *               policeStation:
 *                 type: string
 *                 description: ObjectId of police station. Omit for STATION_OFFICER (injected from JWT). Optional for HQ when not station-scoped.
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: "Comma-separated fields, prefix with `-` for descending. Allowed: registrationNumber, deviceId, createdAt, updatedAt."
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
 *         description: Tuk list (X-Total-Count + Link headers; supports If-None-Match for 304 Not Modified)
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
 *     summary: Get latest resolved district/province per tuk (scoped by role; stale pings excluded)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provinceId
 *         schema:
 *           type: string
 *         description: Optional for HQ only (forced from JWT for province admins).
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *         description: Optional for HQ only (forced from JWT for district/station roles).
 *       - in: query
 *         name: maxAgeMinutes
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Latest ping must be newer than this many minutes (default 60, or CURRENT_AREA_MAX_AGE_MINUTES).
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
const lastPingAreaChain = [
  authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"),
  applyScope("tukLastPingArea", "read"),
  getTuksLastPingArea
];

router.get("/last-ping-area", ...lastPingAreaChain);
/** @deprecated Use GET /tuk/last-ping-area — same handler */
router.get("/current-area", ...lastPingAreaChain);
router.get("/:id/last-location", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getTukLastLocation);
router.get("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getTukById);
router.put("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("tuk", "write"), tukUpdateValidator, validateRequest, updateTuk);
router.delete("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), deleteTuk);

export default router;
