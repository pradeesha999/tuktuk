// District routes: maps API endpoints to controller actions.
import express from "express";
import {
  createDistrict,
  getDistricts,
  getDistrictById,
  updateDistrict,
  deleteDistrict
} from "../controllers/districtController.js";

const router = express.Router();

router.post("/", createDistrict);
router.get("/", getDistricts);
router.get("/:id", getDistrictById);
router.put("/:id", updateDistrict);
router.delete("/:id", deleteDistrict);

export default router;
