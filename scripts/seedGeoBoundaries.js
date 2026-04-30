import dotenv from "dotenv";
import mongoose from "mongoose";
import District from "../src/models/District.js";
import Province from "../src/models/Province.js";

dotenv.config();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchBoundary = async (query) => {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "webapi-boundary-seeder/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status}) for query: ${query}`);
  }

  const body = await response.json();
  const geo = body?.[0]?.geojson;
  if (!geo || !["Polygon", "MultiPolygon"].includes(geo.type)) {
    return null;
  }
  return geo;
};

const updateProvinceBoundary = async (province) => {
  const query = `${province.name} Province, Sri Lanka`;
  const boundary = await fetchBoundary(query);
  if (!boundary) {
    console.warn(`No province boundary found: ${province.name}`);
    return false;
  }
  await Province.findByIdAndUpdate(province._id, { boundary });
  console.log(`Province boundary updated: ${province.name}`);
  return true;
};

const updateDistrictBoundary = async (district) => {
  const query = `${district.name} District, Sri Lanka`;
  let boundary = await fetchBoundary(query);
  if (!boundary) {
    boundary = await fetchBoundary(`${district.name}, Sri Lanka`);
  }

  if (!boundary) {
    console.warn(`No district boundary found: ${district.name}`);
    return false;
  }
  await District.findByIdAndUpdate(district._id, { boundary });
  console.log(`District boundary updated: ${district.name}`);
  return true;
};

const seedGeoBoundaries = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB Connected");

  try {
    const provinces = await Province.find().sort({ name: 1 });
    const districts = await District.find().sort({ name: 1 });

    let provinceHits = 0;
    for (const province of provinces) {
      provinceHits += (await updateProvinceBoundary(province)) ? 1 : 0;
      await delay(1100);
    }

    let districtHits = 0;
    for (const district of districts) {
      districtHits += (await updateDistrictBoundary(district)) ? 1 : 0;
      await delay(1100);
    }

    console.log(`Geo boundary seed complete: provinces=${provinceHits}/${provinces.length}, districts=${districtHits}/${districts.length}`);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

seedGeoBoundaries().catch((error) => {
  console.error(error);
  process.exit(1);
});
