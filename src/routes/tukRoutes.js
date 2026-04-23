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

const router = express.Router();

router.post("/", createTukTuk);
router.get("/", getTukTuks);
router.get("/:id", getTukById);
router.get("/:id/last-location", getTukLastLocation);
router.put("/:id", updateTuk);
router.delete("/:id", deleteTuk);

export default router;
