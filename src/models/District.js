// District model: stores district master data, belongs to one province.
import mongoose from "mongoose";

const districtSchema = new mongoose.Schema(
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
    province: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Province",
      required: true
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

districtSchema.index({ boundary: "2dsphere" });

export default mongoose.model("District", districtSchema);
