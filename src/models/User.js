import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["HQ_ADMIN", "PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER", "DEVICE"],
      required: true
    },
    provinceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Province",
      default: null
    },
    districtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "District",
      default: null
    },
    stationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PoliceStation",
      default: null
    },
    tukId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tuk",
      default: null
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
