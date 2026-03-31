import express from "express";
import dotenv from "dotenv";
import tuktukRoutes from "./routes/tuktukRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());

// Routes
app.use("/api/v1/tuktuks", tuktukRoutes);

export default app;