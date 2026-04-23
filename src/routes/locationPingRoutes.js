// Location ping routes: maps movement log endpoints to controller actions.
import express from "express";
import { createLocationPing, getLocationPings } from "../controllers/locationPingController.js";
import { applyScope, authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { locationPingCreateValidator } from "../validators/resourceValidators.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: LocationPing
 *     description: Location ping ingestion and history
 */
/**
 * @swagger
 * /location-ping:
 *   post:
 *     tags: [LocationPing]
 *     summary: Create location ping
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Location ping created
 *   get:
 *     tags: [LocationPing]
 *     summary: List location pings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tukId
 *         schema:
 *           type: string
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *       - in: query
 *         name: provinceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Location ping list
 */
router.use(authenticateToken);

router.post(
  "/",
  authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER", "DEVICE"),
  applyScope("locationPing", "write"),
  locationPingCreateValidator,
  validateRequest,
  createLocationPing
);
router.get(
  "/",
  authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"),
  applyScope("locationPing", "list"),
  getLocationPings
);

export default router;
