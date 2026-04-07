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
    }
  },
  { timestamps: true }
);

export default mongoose.model("Province", provinceSchema);
