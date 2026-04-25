// Server entry point: connect DB and start listening.
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { validateRequiredEnv } from "./src/config/env.js";

const PORT = process.env.PORT || 5000;

validateRequiredEnv();
connectDB();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});