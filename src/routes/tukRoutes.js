import express from "express";
import {
  createTukTuk,
  getTukTuks,
  getTukById,
  updateTuk,
  deleteTuk
} from "../controllers/tukController.js";

const router = express.Router();

router.post("/", createTukTuk);
router.get("/", getTukTuks);
router.get("/:id", getTukById);
router.put("/:id", updateTuk);
router.delete("/:id", deleteTuk);

export default router;
