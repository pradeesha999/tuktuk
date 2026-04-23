// Tuk routes: maps API endpoints to controller actions.
import express from "express";
import {
  createTukTuk,
  getTukTuks,
  getTukById,
  getTukLastLocation,
  updateTuk,
  deleteTuk
} from "../controllers/tukController.js";
import { applyScope, authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { tukCreateValidator, tukUpdateValidator } from "../validators/resourceValidators.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("tuk", "write"), tukCreateValidator, validateRequest, createTukTuk);
router.get("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("tuk", "list"), getTukTuks);
router.get("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getTukById);
router.get("/:id/last-location", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getTukLastLocation);
router.put("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("tuk", "write"), tukUpdateValidator, validateRequest, updateTuk);
router.delete("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), deleteTuk);

export default router;
