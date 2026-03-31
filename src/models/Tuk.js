import mongoose from "mongoose";

const tukTukSchema = new mongoose.Schema({
  registrationNumber: {
    type: String,
    required: true,
    unique: true
  },
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  ownerName: {
    type: String
  },
  district: {
    type: String
  }
}, { timestamps: true });

export default mongoose.model("TukTuk", tukTukSchema);