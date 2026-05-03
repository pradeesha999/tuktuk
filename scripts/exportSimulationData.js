// Export the seeded master data and simulated pings to JSON and CSV
// so the brief's "Simulation Data: JSON or CSV" deliverable has a real artefact.
//
// Usage: npm run export:simulation
// Output: data/provinces.json|.csv, data/districts.json|.csv,
//         data/police_stations.json|.csv, data/tuks.json|.csv,
//         data/location_pings.json, data/location_pings.csv
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

const asId = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String(value._id);
  }
  return String(value);
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
    const provinceCsvRows = provinces.map((p) => ({
      _id: asId(p._id),
      name: p.name,
      code: p.code,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt ?? ""
    }));
    await writeCsv("provinces.csv", provinceCsvRows, [
      "_id",
      "name",
      "code",
      "createdAt",
      "updatedAt",
      "deletedAt"
    ]);

    const districts = await District.find(mergeActive())
      .select("-boundary")
      .sort({ code: 1 })
      .lean();
    await writeJson("districts.json", districts);
    const districtCsvRows = districts.map((d) => ({
      _id: asId(d._id),
      name: d.name,
      code: d.code,
      province: asId(d.province),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      deletedAt: d.deletedAt ?? ""
    }));
    await writeCsv("districts.csv", districtCsvRows, [
      "_id",
      "name",
      "code",
      "province",
      "createdAt",
      "updatedAt",
      "deletedAt"
    ]);

    const stations = await PoliceStation.find(mergeActive()).sort({ code: 1 }).lean();
    await writeJson("police_stations.json", stations);
    const stationCsvRows = stations.map((s) => ({
      _id: asId(s._id),
      name: s.name,
      code: s.code,
      district: asId(s.district),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      deletedAt: s.deletedAt ?? ""
    }));
    await writeCsv("police_stations.csv", stationCsvRows, [
      "_id",
      "name",
      "code",
      "district",
      "createdAt",
      "updatedAt",
      "deletedAt"
    ]);

    const tuks = await Tuk.find(mergeActive()).sort({ registrationNumber: 1 }).lean();
    await writeJson("tuks.json", tuks);
    const tukCsvRows = tuks.map((t) => ({
      _id: asId(t._id),
      registrationNumber: t.registrationNumber,
      deviceId: t.deviceId,
      ownerName: t.ownerName ?? "",
      district: asId(t.district),
      policeStation: t.policeStation ? asId(t.policeStation) : "",
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      deletedAt: t.deletedAt ?? ""
    }));
    await writeCsv("tuks.csv", tukCsvRows, [
      "_id",
      "registrationNumber",
      "deviceId",
      "ownerName",
      "district",
      "policeStation",
      "createdAt",
      "updatedAt",
      "deletedAt"
    ]);

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
