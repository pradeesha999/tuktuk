// Mongo connection helper used on server startup and seed/simulate scripts.
import mongoose from "mongoose";

/** Default DB for the API and CLI scripts. Integration tests use `webapi_test` in test/api.test.js instead. */
export const getAppDatabaseName = () => process.env.MONGO_DB_NAME || "webapi_prod";

/** Connect Mongoose to the app database. Throws if MONGO_URI is missing or the connection fails. */
export const connectAppMongoose = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: getAppDatabaseName() });
  console.log(`MongoDB connected — database "${getAppDatabaseName()}"`);
};

export default connectAppMongoose;
