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
    }
  },
  { timestamps: true }
);

export default mongoose.model("District", districtSchema);
