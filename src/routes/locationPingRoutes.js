// Location ping routes: maps movement log endpoints to controller actions.
import express from "express";
import { createLocationPing, getLocationPings } from "../controllers/locationPingController.js";

const router = express.Router();

router.post("/", createLocationPing);
router.get("/", getLocationPings);

export default router;
