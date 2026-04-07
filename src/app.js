// Express app setup and route mounting.
import express from "express";
import dotenv from "dotenv";
import tukRoutes from "./routes/tukRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/v1/tuk", tukRoutes);

export default app;