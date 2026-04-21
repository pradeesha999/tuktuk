import dotenv from "dotenv";
import mongoose from "mongoose";
import District from "../src/models/District.js";
import PoliceStation from "../src/models/PoliceStation.js";

dotenv.config();

const buildStationCode = (districtCode) => `${districtCode}-PS`;

const seedPoliceStations = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB Connected");

  try {
    const districts = await District.find().sort({ name: 1 });

    for (const district of districts) {
      const stationName = `${district.name} Police Station`;
      const stationCode = buildStationCode(district.code);

      await PoliceStation.findOneAndUpdate(
        { district: district._id },
        {
          name: stationName,
          code: stationCode,
          district: district._id
        },
        { upsert: true, runValidators: true }
      );
    }

    const totalDistricts = await District.countDocuments();
    const totalStations = await PoliceStation.countDocuments();
    console.log(`Seed complete: ${totalStations} stations for ${totalDistricts} districts`);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

seedPoliceStations().catch((error) => {
  console.error(error);
  process.exit(1);
});
