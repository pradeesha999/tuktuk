// Province routes: maps API endpoints to controller actions.
import express from "express";
import {
  createProvince,
  getProvinces,
  getProvinceById,
  updateProvince,
  deleteProvince
} from "../controllers/provinceController.js";
import { authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { provinceCreateValidator, provinceUpdateValidator } from "../validators/resourceValidators.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", authorizeRoles("HQ_ADMIN"), provinceCreateValidator, validateRequest, createProvince);
router.get("/", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getProvinces);
router.get("/:id", authorizeRoles("HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"), getProvinceById);
router.put("/:id", authorizeRoles("HQ_ADMIN"), provinceUpdateValidator, validateRequest, updateProvince);
router.delete("/:id", authorizeRoles("HQ_ADMIN"), deleteProvince);

export default router;
