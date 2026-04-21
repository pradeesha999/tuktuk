// Police station routes: maps API endpoints to controller actions.
import express from "express";
import {
  createPoliceStation,
  getPoliceStations,
  getPoliceStationById,
  updatePoliceStation,
  deletePoliceStation
} from "../controllers/policeStationController.js";

const router = express.Router();

router.post("/", createPoliceStation);
router.get("/", getPoliceStations);
router.get("/:id", getPoliceStationById);
router.put("/:id", updatePoliceStation);
router.delete("/:id", deletePoliceStation);

export default router;
