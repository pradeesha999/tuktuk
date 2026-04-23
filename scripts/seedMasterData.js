import dotenv from "dotenv";
import mongoose from "mongoose";
import District from "../src/models/District.js";
import PoliceStation from "../src/models/PoliceStation.js";
import Province from "../src/models/Province.js";

dotenv.config();

const provinces = [
  { name: "Western", code: "WP" },
  { name: "Central", code: "CP" },
  { name: "Southern", code: "SP" },
  { name: "Northern", code: "NP" },
  { name: "Eastern", code: "EP" },
  { name: "North Western", code: "NWP" },
  { name: "North Central", code: "NCP" },
  { name: "Uva", code: "UP" },
  { name: "Sabaragamuwa", code: "SGP" }
];

const districtsByProvince = {
  Western: [
    { name: "Colombo", code: "CMB" },
    { name: "Gampaha", code: "GMP" },
    { name: "Kalutara", code: "KLT" }
  ],
  Central: [
    { name: "Kandy", code: "KDY" },
    { name: "Matale", code: "MTL" },
    { name: "Nuwara Eliya", code: "NWE" }
  ],
  Southern: [
    { name: "Galle", code: "GAL" },
    { name: "Matara", code: "MTR" },
    { name: "Hambantota", code: "HMB" }
  ],
  Northern: [
    { name: "Jaffna", code: "JFN" },
    { name: "Kilinochchi", code: "KLN" },
    { name: "Mannar", code: "MNR" },
    { name: "Vavuniya", code: "VAV" },
    { name: "Mullaitivu", code: "MLT" }
  ],
  Eastern: [
    { name: "Batticaloa", code: "BTC" },
    { name: "Ampara", code: "AMP" },
    { name: "Trincomalee", code: "TRC" }
  ],
  "North Western": [
    { name: "Kurunegala", code: "KUR" },
    { name: "Puttalam", code: "PUT" }
  ],
  "North Central": [
    { name: "Anuradhapura", code: "ANU" },
    { name: "Polonnaruwa", code: "POL" }
  ],
  Uva: [
    { name: "Badulla", code: "BAD" },
    { name: "Monaragala", code: "MON" }
  ],
  Sabaragamuwa: [
    { name: "Ratnapura", code: "RAT" },
    { name: "Kegalle", code: "KEG" }
  ]
};

const seedMasterData = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB Connected");

  try {
    const provinceMap = new Map();

    for (const provinceData of provinces) {
      const province = await Province.findOneAndUpdate(
        { $or: [{ name: provinceData.name }, { code: provinceData.code }] },
        provinceData,
        { upsert: true, returnDocument: "after", runValidators: true }
      );
      provinceMap.set(province.name, province._id);
    }

    for (const [provinceName, districts] of Object.entries(districtsByProvince)) {
      const provinceId = provinceMap.get(provinceName);

      for (const districtData of districts) {
        const district = await District.findOneAndUpdate(
          { $or: [{ name: districtData.name }, { code: districtData.code }] },
          { ...districtData, province: provinceId },
          { upsert: true, returnDocument: "after", runValidators: true }
        );

        await PoliceStation.findOneAndUpdate(
          { district: district._id },
          { name: `${district.name} Police Station`, code: `${district.code}-PS`, district: district._id },
          { upsert: true, returnDocument: "after", runValidators: true }
        );
      }
    }

    const [provinceCount, districtCount, stationCount] = await Promise.all([
      Province.countDocuments(),
      District.countDocuments(),
      PoliceStation.countDocuments()
    ]);
    console.log(`Master data ready: ${provinceCount} provinces, ${districtCount} districts, ${stationCount} stations`);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

seedMasterData().catch((error) => {
  console.error(error);
  process.exit(1);
});
