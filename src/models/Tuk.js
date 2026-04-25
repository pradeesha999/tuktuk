// Tuk model: stores registered vehicle and device details.
import mongoose from "mongoose";

const tukSchema = new mongoose.Schema(
  {
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
      type: mongoose.Schema.Types.ObjectId,
      ref: "District",
      required: true
    },
    policeStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PoliceStation"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Tuk", tukSchema);