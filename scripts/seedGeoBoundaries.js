import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectAppMongoose, getAppDatabaseName } from "../src/config/db.js";
import District from "../src/models/District.js";
import Province from "../src/models/Province.js";

dotenv.config();

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const REQUEST_DELAY_MS = 1100;
const USER_AGENT = "WebapiCoursework/1.0 (tuktuk tracking demo; educational use)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const geometryFromNominatimFeature = (geojson) => {
  if (!geojson || typeof geojson !== "object") return null;
  const { type, coordinates } = geojson;
  if (type === "Polygon" || type === "MultiPolygon") {
    return { type, coordinates };
  }
  return null;
};

const fetchBoundaryGeometry = async (query) => {
  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("limit", "3");

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Nominatim HTTP ${response.status} for query: ${query}`);
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  for (const item of results) {
    const geom = geometryFromNominatimFeature(item.geojson);
    if (geom) return geom;
  }
  return null;
};

const seedProvinceBoundaries = async () => {
  const provinces = await Province.find({ deletedAt: null }).sort({ code: 1 }).lean();
  let updated = 0;

  for (const p of provinces) {
    const queries = [`${p.name} Province, Sri Lanka`, `${p.name}, Sri Lanka`];
    let geom = null;
    for (const q of queries) {
      await sleep(REQUEST_DELAY_MS);
      geom = await fetchBoundaryGeometry(q);
      if (geom) break;
    }

    if (!geom) {
      console.warn(`No polygon found for province "${p.name}" (${p.code})`);
      continue;
    }

    await Province.updateOne({ _id: p._id }, { $set: { boundary: geom } });
    updated += 1;
    console.log(`Province boundary: ${p.name} (${p.code})`);
  }

  return updated;
};

const seedDistrictBoundaries = async () => {
  const districts = await District.find({ deletedAt: null }).sort({ code: 1 }).lean();
  let updated = 0;

  for (const d of districts) {
    const queries = [`${d.name} District, Sri Lanka`, `${d.name}, Sri Lanka`];
    let geom = null;
    for (const q of queries) {
      await sleep(REQUEST_DELAY_MS);
      geom = await fetchBoundaryGeometry(q);
      if (geom) break;
    }

    if (!geom) {
      console.warn(`No polygon found for district "${d.name}" (${d.code})`);
      continue;
    }

    await District.updateOne({ _id: d._id }, { $set: { boundary: geom } });
    updated += 1;
    console.log(`District boundary: ${d.name} (${d.code})`);
  }

  return updated;
};

const main = async () => {
  await connectAppMongoose();
  console.log(`MongoDB connected — database "${getAppDatabaseName()}"`);
  console.log("Fetching OSM boundaries via Nominatim (rate-limited; may take several minutes).");

  try {
    const provinceDone = await seedProvinceBoundaries();
    const districtDone = await seedDistrictBoundaries();
    console.log(`Geo boundaries done: ${provinceDone} provinces, ${districtDone} districts updated.`);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
