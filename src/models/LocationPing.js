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
    point: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        default: undefined
      }
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
    },
    resolvedDistrict: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "District",
      default: null
    },
    resolvedProvince: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Province",
      default: null
    }
  },
  { timestamps: true }
);

locationPingSchema.index({ tuk: 1, pingedAt: -1 });
locationPingSchema.index({ point: "2dsphere" });
locationPingSchema.index({ resolvedDistrict: 1, pingedAt: -1 });
locationPingSchema.index({ resolvedProvince: 1, pingedAt: -1 });

export default mongoose.model("LocationPing", locationPingSchema);
