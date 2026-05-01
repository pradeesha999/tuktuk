// Express app setup and route mounting.
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
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

app.set("trust proxy", 1);
app.set("etag", "strong");

const globalLimiter = rateLimit({
  windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "", 10) || 15 * 60 * 1000,
  limit: Number.parseInt(process.env.RATE_LIMIT_MAX || "", 10) || 300,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || "", 10) || 10 * 60 * 1000,
  limit: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || "", 10) || 40,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(
  cors({
    origin: corsOrigin,
    exposedHeaders: ["X-Total-Count", "Link", "ETag"]
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(globalLimiter);

app.use("/api/v1/tuk", tukRoutes);
app.use("/api/v1/province", provinceRoutes);
app.use("/api/v1/district", districtRoutes);
app.use("/api/v1/police-station", policeStationRoutes);
app.use("/api/v1/location-ping", locationPingRoutes);
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

export default app;