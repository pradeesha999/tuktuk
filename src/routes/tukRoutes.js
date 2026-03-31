import express from "express";
import { createTukTuk, getTukTuks } from "../controllers/tukController.js";

const router = express.Router();

router.post("/", createTukTuk);
router.get("/", getTukTuks);

export default router;
