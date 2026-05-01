// Server entry point: connect DB and start listening.
import app from "./src/app.js";
import connectAppMongoose from "./src/config/db.js";
import { validateRequiredEnv } from "./src/config/env.js";

const PORT = process.env.PORT || 5000;

validateRequiredEnv();

connectAppMongoose()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start: ", error.message);
    process.exit(1);
  });