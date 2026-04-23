// Location ping routes: maps movement log endpoints to controller actions.
import express from "express";
import { createLocationPing, getLocationPings } from "../controllers/locationPingController.js";
import { applyScope, authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { locationPingCreateValidator } from "../validators/resourceValidators.js";

const router = express.Router();

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
