// Location ping model: stores periodic GPS updates from tracking devices.
import mongoose from "mongoose";

const locationPingSchema = new mongoose.Schema(
  {
    tuk: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tuk",
      required: true,
      index: true
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    pingedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    speedKmh: {
      type: Number,
      min: 0
    },
    heading: {
      type: Number,
      min: 0,
      max: 359
    },
    source: {
      type: String,
      default: "device"
    }
  },
  { timestamps: true }
);

locationPingSchema.index({ tuk: 1, pingedAt: -1 });

export default mongoose.model("LocationPing", locationPingSchema);
