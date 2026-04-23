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

router.use(authenticateToken);

router.post("/", authorizeRoles("HQ_ADMIN"), policeStationCreateValidator, validateRequest, createPoliceStation);
router.get("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("policeStation", "list"), getPoliceStations);
router.get("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getPoliceStationById);
router.put("/:id", authorizeRoles("HQ_ADMIN"), policeStationUpdateValidator, validateRequest, updatePoliceStation);
router.delete("/:id", authorizeRoles("HQ_ADMIN"), deletePoliceStation);

export default router;
