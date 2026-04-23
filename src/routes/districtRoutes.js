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

router.use(authenticateToken);

router.post("/", authorizeRoles("HQ_ADMIN"), districtCreateValidator, validateRequest, createDistrict);
router.get("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), applyScope("district", "list"), getDistricts);
router.get("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getDistrictById);
router.put("/:id", authorizeRoles("HQ_ADMIN"), districtUpdateValidator, validateRequest, updateDistrict);
router.delete("/:id", authorizeRoles("HQ_ADMIN"), deleteDistrict);

export default router;
