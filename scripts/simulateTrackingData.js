import dotenv from "dotenv";
import mongoose from "mongoose";
import District from "../src/models/District.js";
import LocationPing from "../src/models/LocationPing.js";
import PoliceStation from "../src/models/PoliceStation.js";
import "../src/models/Province.js";
import Tuk from "../src/models/Tuk.js";

dotenv.config();

const TOTAL_TUKS = 200;
const HOURS_BACK = 24 * 7;
const PING_INTERVAL_HOURS = 3;

const randomInRange = (min, max) => Math.random() * (max - min) + min;

const generateCoordinatesByProvince = (provinceName) => {
  const boxes = {
    Western: { lat: [6.7, 7.4], lon: [79.8, 80.3] },
    Central: { lat: [7.0, 7.7], lon: [80.4, 81.0] },
    Southern: { lat: [5.8, 6.5], lon: [80.2, 81.0] },
    Northern: { lat: [8.7, 9.9], lon: [79.7, 80.8] },
    Eastern: { lat: [7.1, 8.4], lon: [81.1, 81.9] },
    "North Western": { lat: [7.2, 8.1], lon: [79.8, 80.6] },
    "North Central": { lat: [7.8, 8.8], lon: [80.5, 81.4] },
    Uva: { lat: [6.6, 7.2], lon: [80.9, 81.5] },
    Sabaragamuwa: { lat: [6.4, 7.1], lon: [80.2, 80.9] }
  };
  const box = boxes[provinceName] || boxes.Western;
  return {
    latitude: Number.parseFloat(randomInRange(box.lat[0], box.lat[1]).toFixed(6)),
    longitude: Number.parseFloat(randomInRange(box.lon[0], box.lon[1]).toFixed(6))
  };
};

const simulateTrackingData = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB Connected");

  try {
    const districts = await District.find().populate("province");
    const stations = await PoliceStation.find();

    if (!districts.length || !stations.length) {
      throw new Error("Run master data seeding first");
    }

    const createdTuks = [];
    for (let i = 0; i < TOTAL_TUKS; i += 1) {
      const district = districts[i % districts.length];
      const station = stations.find((item) => String(item.district) === String(district._id));
      const registrationNumber = `WP-${String(1000 + i)}`;
      const deviceId = `device-${String(i + 1).padStart(4, "0")}`;

      const tuk = await Tuk.findOneAndUpdate(
        { registrationNumber },
        {
          registrationNumber,
          deviceId,
          ownerName: `Owner ${i + 1}`,
          district: district._id,
          policeStation: station?._id
        },
        { upsert: true, returnDocument: "after", runValidators: true }
      );
      createdTuks.push({ tuk, district });
    }

    const startTime = new Date(Date.now() - HOURS_BACK * 60 * 60 * 1000);
    const pings = [];

    for (const item of createdTuks) {
      for (let h = 0; h <= HOURS_BACK; h += PING_INTERVAL_HOURS) {
        const pingedAt = new Date(startTime.getTime() + h * 60 * 60 * 1000);
        const coords = generateCoordinatesByProvince(item.district.province.name);
        pings.push({
          tuk: item.tuk._id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          pingedAt,
          speedKmh: Number.parseFloat(randomInRange(0, 55).toFixed(2)),
          heading: Math.floor(randomInRange(0, 360)),
          source: "simulated"
        });
      }
    }

    await LocationPing.deleteMany({ source: "simulated" });
    await LocationPing.insertMany(pings, { ordered: false });
    console.log(`Simulation complete: ${createdTuks.length} tuks and ${pings.length} pings`);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

simulateTrackingData().catch((error) => {
  console.error(error);
  process.exit(1);
});
