// Export the seeded master data and simulated pings to JSON (and CSV for pings)
// so the brief's "Simulation Data: JSON or CSV" deliverable has a real artefact
// in the repo.
//
// Usage: npm run export:simulation
// Output: data/provinces.json, data/districts.json, data/police_stations.json,
//         data/tuks.json, data/location_pings.json, data/location_pings.csv
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectAppMongoose, getAppDatabaseName } from "../src/config/db.js";
import District from "../src/models/District.js";
import LocationPing from "../src/models/LocationPing.js";
import PoliceStation from "../src/models/PoliceStation.js";
import Province from "../src/models/Province.js";
import Tuk from "../src/models/Tuk.js";
import { mergeActive } from "../src/utils/softDelete.js";

dotenv.config();

const OUT_DIR = path.resolve("data");

const writeJson = async (file, rows) => {
  const target = path.join(OUT_DIR, file);
  await fs.writeFile(target, JSON.stringify(rows, null, 2), "utf8");
  console.log(`  wrote ${rows.length.toLocaleString()} -> ${target}`);
};

const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const writeCsv = async (file, rows, columns) => {
  const target = path.join(OUT_DIR, file);
  const header = columns.join(",");
  const body = rows
    .map((row) => columns.map((c) => csvEscape(row[c])).join(","))
    .join("\n");
  await fs.writeFile(target, `${header}\n${body}\n`, "utf8");
  console.log(`  wrote ${rows.length.toLocaleString()} -> ${target}`);
};

const main = async () => {
  await connectAppMongoose();
  console.log(`MongoDB connected — database "${getAppDatabaseName()}"`);
  await fs.mkdir(OUT_DIR, { recursive: true });

  try {
    const provinces = await Province.find(mergeActive())
      .select("-boundary")
      .sort({ code: 1 })
      .lean();
    await writeJson("provinces.json", provinces);

    const districts = await District.find(mergeActive())
      .select("-boundary")
      .sort({ code: 1 })
      .lean();
    await writeJson("districts.json", districts);

    const stations = await PoliceStation.find(mergeActive()).sort({ code: 1 }).lean();
    await writeJson("police_stations.json", stations);

    const tuks = await Tuk.find(mergeActive()).sort({ registrationNumber: 1 }).lean();
    await writeJson("tuks.json", tuks);

    const pings = await LocationPing.find({ source: "simulated" })
      .sort({ tuk: 1, pingedAt: 1 })
      .lean();

    const flatPings = pings.map((p) => ({
      _id: String(p._id),
      tuk: String(p.tuk),
      pingedAt: p.pingedAt,
      latitude: p.latitude,
      longitude: p.longitude,
      speedKmh: p.speedKmh ?? "",
      heading: p.heading ?? "",
      source: p.source,
      resolvedDistrict: p.resolvedDistrict ? String(p.resolvedDistrict) : "",
      resolvedProvince: p.resolvedProvince ? String(p.resolvedProvince) : ""
    }));

    await writeJson("location_pings.json", flatPings);
    await writeCsv("location_pings.csv", flatPings, [
      "_id",
      "tuk",
      "pingedAt",
      "latitude",
      "longitude",
      "speedKmh",
      "heading",
      "source",
      "resolvedDistrict",
      "resolvedProvince"
    ]);

    console.log(`Simulation export complete in ${OUT_DIR}`);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
