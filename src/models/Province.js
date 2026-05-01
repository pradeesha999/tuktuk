// Province model: stores province master data.
import mongoose from "mongoose";

const provinceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    boundary: {
      type: {
        type: String,
        enum: ["Polygon", "MultiPolygon"]
      },
      coordinates: {
        type: Array
      }
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  { timestamps: true }
);

provinceSchema.index({ boundary: "2dsphere" });

export default mongoose.model("Province", provinceSchema);
