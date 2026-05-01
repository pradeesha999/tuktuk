// Mongo connection helper used on server startup and seed/simulate scripts.
import mongoose from "mongoose";

/** Default DB for the API and CLI scripts. Integration tests use `webapi_test` in test/api.test.js instead. */
export const getAppDatabaseName = () => process.env.MONGO_DB_NAME || "webapi_prod";

/** Shared Mongoose connection for app server + maintenance scripts. */
export const connectAppMongoose = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: getAppDatabaseName() });
};

const connectDB = async () => {
  try {
    await connectAppMongoose();
    console.log(`MongoDB connected — database "${getAppDatabaseName()}"`);
  } catch (error) {
    console.error(error);
  }
};

export default connectDB;
