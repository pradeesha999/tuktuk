// Police station routes: maps API endpoints to controller actions.
import express from "express";
import {
  createPoliceStation,
  getPoliceStations,
  getPoliceStationById,
  updatePoliceStation,
  deletePoliceStation
} from "../controllers/policeStationController.js";
import { applyScope, authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { policeStationCreateValidator, policeStationUpdateValidator } from "../validators/resourceValidators.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: PoliceStation
 *     description: Police station management
 */
/**
 * @swagger
 * /police-station:
 *   post:
 *     tags: [PoliceStation]
 *     summary: Create police station
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Police station created
 *   get:
 *     tags: [PoliceStation]
 *     summary: List police stations
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
 *     responses:
 *       200:
 *         description: Police station list
 */
/**
 * @swagger
 * /police-station/{id}:
 *   get:
 *     tags: [PoliceStation]
 *     summary: Get police station by id
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
 *         description: Police station found
 *   put:
 *     tags: [PoliceStation]
 *     summary: Update police station
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
 *         description: Police station updated
 *   delete:
 *     tags: [PoliceStation]
 *     summary: Delete police station
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
 *         description: Police station deleted
 */
router.use(authenticateToken);

router.post("/", authorizeRoles("HQ_ADMIN"), policeStationCreateValidator, validateRequest, createPoliceStation);
router.get("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("policeStation", "list"), getPoliceStations);
router.get("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getPoliceStationById);
router.put("/:id", authorizeRoles("HQ_ADMIN"), policeStationUpdateValidator, validateRequest, updatePoliceStation);
router.delete("/:id", authorizeRoles("HQ_ADMIN"), deletePoliceStation);

export default router;
