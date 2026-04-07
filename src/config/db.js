// Mongo connection helper used on server startup.
import mongoose from "mongoose";

// Connect to MongoDB Atlas using the URI from env.
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error(error);
  }
};

export default connectDB;