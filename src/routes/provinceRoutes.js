// Province routes: maps API endpoints to controller actions.
import express from "express";
import {
  createProvince,
  getProvinces,
  getProvinceById,
  updateProvince,
  deleteProvince
} from "../controllers/provinceController.js";

const router = express.Router();

router.post("/", createProvince);
router.get("/", getProvinces);
router.get("/:id", getProvinceById);
router.put("/:id", updateProvince);
router.delete("/:id", deleteProvince);

export default router;
