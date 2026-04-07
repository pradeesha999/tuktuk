// Express app setup and route mounting.
import express from "express";
import dotenv from "dotenv";
import tukRoutes from "./routes/tukRoutes.js";
import provinceRoutes from "./routes/provinceRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/v1/tuk", tukRoutes);
app.use("/api/v1/province", provinceRoutes);

export default app;