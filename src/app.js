// Express app setup and route mounting.
import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import tukRoutes from "./routes/tukRoutes.js";
import provinceRoutes from "./routes/provinceRoutes.js";
import districtRoutes from "./routes/districtRoutes.js";
import locationPingRoutes from "./routes/locationPingRoutes.js";
import policeStationRoutes from "./routes/policeStationRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import swaggerSpec from "./config/swagger.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/v1/tuk", tukRoutes);
app.use("/api/v1/province", provinceRoutes);
app.use("/api/v1/district", districtRoutes);
app.use("/api/v1/police-station", policeStationRoutes);
app.use("/api/v1/location-ping", locationPingRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

export default app;