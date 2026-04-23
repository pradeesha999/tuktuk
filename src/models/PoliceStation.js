// Police station model: belongs to one district (law-enforcement org master data).
import mongoose from "mongoose";

const policeStationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "District",
      required: true
    }
  },
  { timestamps: true }
);

policeStationSchema.index({ name: 1, district: 1 }, { unique: true });

export default mongoose.model("PoliceStation", policeStationSchema);
