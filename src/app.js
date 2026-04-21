// Express app setup and route mounting.
import express from "express";
import dotenv from "dotenv";
import tukRoutes from "./routes/tukRoutes.js";
import provinceRoutes from "./routes/provinceRoutes.js";
import districtRoutes from "./routes/districtRoutes.js";
import policeStationRoutes from "./routes/policeStationRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/v1/tuk", tukRoutes);
app.use("/api/v1/province", provinceRoutes);
app.use("/api/v1/district", districtRoutes);
app.use("/api/v1/police-station", policeStationRoutes);

export default app;