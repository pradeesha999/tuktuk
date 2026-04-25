const requiredEnv = ["MONGO_URI", "JWT_SECRET"];

export const validateRequiredEnv = () => {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

