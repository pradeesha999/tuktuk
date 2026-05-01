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

const intEnv = (name, fallback) =>
  Number.parseInt(process.env[name] || "", 10) || fallback;

const buildLimiter = (windowMs, limit) =>
  rateLimit({ windowMs, limit, standardHeaders: "draft-8", legacyHeaders: false });

const globalLimiter = buildLimiter(
  intEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  intEnv("RATE_LIMIT_MAX", 300)
);
const authLimiter = buildLimiter(
  intEnv("AUTH_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000),
  intEnv("AUTH_RATE_LIMIT_MAX", 40)
);

const app = express();

app.set("trust proxy", 1);
app.set("etag", "strong");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    exposedHeaders: ["X-Total-Count", "Link", "ETag"]
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(globalLimiter);

app.get("/", (req, res) => {
  res.json({
    name: "Tuk-Tuk Tracking API",
    version: "1.0.0",
    docs: "/api-docs",
    health: "/health",
    api: "/api/v1"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/v1/tuk", tukRoutes);
app.use("/api/v1/province", provinceRoutes);
app.use("/api/v1/district", districtRoutes);
app.use("/api/v1/police-station", policeStationRoutes);
app.use("/api/v1/location-ping", locationPingRoutes);
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

export default app;