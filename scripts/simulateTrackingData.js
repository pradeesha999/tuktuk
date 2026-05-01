import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectAppMongoose, getAppDatabaseName } from "../src/config/db.js";
import District from "../src/models/District.js";
import LocationPing from "../src/models/LocationPing.js";
import PoliceStation from "../src/models/PoliceStation.js";
import "../src/models/Province.js";
import Tuk from "../src/models/Tuk.js";
import { mergeActive } from "../src/utils/softDelete.js";

dotenv.config();

const TOTAL_TUKS = 200;
const HOURS_BACK = 24 * 7;
const PING_INTERVAL_HOURS = 3;
const R_EARTH_KM = 6371;
const MAX_STEP_ATTEMPTS = 28;
const IN_POLYGON_SAMPLE_ATTEMPTS = 100;

const randomInRange = (min, max) => Math.random() * (max - min) + min;

/** Ray-casting: true if (lon,lat) is inside ring (GeoJSON [lon,lat][]). */
const pointInRing = (lon, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const dy = yj - yi;
    if (Math.abs(dy) < 1e-12) continue;
    const intersect = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / dy + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

/** Point inside GeoJSON Polygon or MultiPolygon (outer rings + holes). */
const pointInBoundaryGeometry = (geom, lon, lat) => {
  if (!geom?.coordinates) return false;
  if (geom.type === "Polygon") {
    const [outer, ...holes] = geom.coordinates;
    if (!outer?.length || !pointInRing(lon, lat, outer)) return false;
    for (const hole of holes) {
      if (hole?.length && pointInRing(lon, lat, hole)) return false;
    }
    return true;
  }
  if (geom.type === "MultiPolygon") {
    for (const polygon of geom.coordinates) {
      const [outer, ...holes] = polygon;
      if (!outer?.length || !pointInRing(lon, lat, outer)) continue;
      let inHole = false;
      for (const hole of holes) {
        if (hole?.length && pointInRing(lon, lat, hole)) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
    return false;
  }
  return false;
};

const extendBBox = (bbox, lon, lat) => {
  if (!bbox) {
    return { minLon: lon, maxLon: lon, minLat: lat, maxLat: lat };
  }
  return {
    minLon: Math.min(bbox.minLon, lon),
    maxLon: Math.max(bbox.maxLon, lon),
    minLat: Math.min(bbox.minLat, lat),
    maxLat: Math.max(bbox.maxLat, lat)
  };
};

const bboxFromGeometry = (geom) => {
  if (!geom || !geom.coordinates) return null;
  let bbox = null;
  const walkRing = (ring) => {
    for (const coord of ring) {
      const [lon, lat] = coord;
      bbox = extendBBox(bbox, lon, lat);
    }
  };
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) {
      walkRing(ring);
    }
  } else if (geom.type === "MultiPolygon") {
    for (const polygon of geom.coordinates) {
      for (const ring of polygon) {
        walkRing(ring);
      }
    }
  } else {
    return null;
  }
  return bbox;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_EARTH_KM * c;
};

const bearingDeg = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const deg = ((θ * 180) / Math.PI + 360) % 360;
  return deg;
};

const destinationPointKm = (lat, lon, bearing, distanceKm) => {
  const δ = distanceKm / R_EARTH_KM;
  const θ = (bearing * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (((λ2 * 180) / Math.PI + 540) % 360) - 180
  };
};

const randomPointInDistrict = (boundary, bbox) => {
  for (let attempt = 0; attempt < IN_POLYGON_SAMPLE_ATTEMPTS; attempt += 1) {
    const lon = randomInRange(bbox.minLon, bbox.maxLon);
    const lat = randomInRange(bbox.minLat, bbox.maxLat);
    if (pointInBoundaryGeometry(boundary, lon, lat)) {
      return { latitude: lat, longitude: lon };
    }
  }
  throw new Error(
    `Could not sample a point inside district boundary after ${IN_POLYGON_SAMPLE_ATTEMPTS} attempts. Run seed:geo-boundaries first.`
  );
};

const nextPingPosition = (boundary, bbox, prevLat, prevLon, prevHeading) => {
  const dtHours = PING_INTERVAL_HOURS;

  for (let attempt = 0; attempt < MAX_STEP_ATTEMPTS; attempt += 1) {
    let heading;
    if (prevHeading == null || Number.isNaN(prevHeading)) {
      heading = randomInRange(0, 360);
    } else {
      heading = (prevHeading + randomInRange(-40, 40) + 360) % 360;
    }
    const distanceKm = randomInRange(0.15, Math.min(4, 35 * dtHours));

    const dest = destinationPointKm(prevLat, prevLon, heading, distanceKm);
    const { latitude, longitude } = dest;

    if (pointInBoundaryGeometry(boundary, longitude, latitude)) {
      const distanceMoved = haversineKm(prevLat, prevLon, latitude, longitude);
      const speedKmh = distanceMoved / dtHours;
      const clampedSpeed = Math.min(55, Math.max(0, speedKmh));
      const trackHeading = Math.floor(bearingDeg(prevLat, prevLon, latitude, longitude));
      return {
        latitude: Number.parseFloat(latitude.toFixed(6)),
        longitude: Number.parseFloat(longitude.toFixed(6)),
        speedKmh: Number.parseFloat(clampedSpeed.toFixed(2)),
        heading: trackHeading
      };
    }
  }

  const anchor = randomPointInDistrict(boundary, bbox);
  const distanceMoved = haversineKm(prevLat, prevLon, anchor.latitude, anchor.longitude);
  const speedKmh = Math.min(55, Math.max(0, distanceMoved / dtHours));
  return {
    latitude: anchor.latitude,
    longitude: anchor.longitude,
    speedKmh: Number.parseFloat(speedKmh.toFixed(2)),
    heading: Math.floor(bearingDeg(prevLat, prevLon, anchor.latitude, anchor.longitude))
  };
};

const provinceIdFromDistrict = (district) => {
  const p = district.province;
  if (!p) return null;
  if (typeof p === "object" && p._id) return p._id;
  return p;
};

const simulateTrackingData = async () => {
  await connectAppMongoose();
  console.log(`MongoDB connected — database "${getAppDatabaseName()}"`);

  try {
    const districts = await District.find(mergeActive()).populate("province");
    const stations = await PoliceStation.find();

    if (!districts.length || !stations.length) {
      throw new Error("Run master data seeding first");
    }

    const districtsWithBoundary = districts.filter((d) => d.boundary?.coordinates?.length);
    if (!districtsWithBoundary.length) {
      throw new Error(
        "No district boundaries in the database. Run: npm run seed:master && npm run seed:geo-boundaries"
      );
    }

    const bboxCache = new Map();
    for (const d of districtsWithBoundary) {
      const bbox = bboxFromGeometry(d.boundary);
      if (bbox) {
        bboxCache.set(String(d._id), bbox);
      }
    }

    console.log(`Upserting ${TOTAL_TUKS} tuks...`);
    const createdTuks = [];
    for (let i = 0; i < TOTAL_TUKS; i += 1) {
      const district = districtsWithBoundary[i % districtsWithBoundary.length];
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
    const pingRows =
      Math.floor(HOURS_BACK / PING_INTERVAL_HOURS) + 1;

    console.log(
      `Generating ${pingRows} pings per tuk (${createdTuks.length} tuks, in-memory geo checks — no per-ping DB round-trips)...`
    );

    let tukIndex = 0;
    for (const item of createdTuks) {
      tukIndex += 1;
      if (tukIndex === 1 || tukIndex % 50 === 0 || tukIndex === createdTuks.length) {
        console.log(`  progress: tuk ${tukIndex}/${createdTuks.length}`);
      }

      const { district } = item;
      const bbox = bboxCache.get(String(district._id));
      if (!bbox) {
        throw new Error(`Missing bbox for district ${district.code}`);
      }

      const boundary = district.boundary;
      const resolvedProvince = provinceIdFromDistrict(district);

      let prevLat;
      let prevLon;
      let prevHeading = null;

      for (let h = 0; h <= HOURS_BACK; h += PING_INTERVAL_HOURS) {
        const pingedAt = new Date(startTime.getTime() + h * 60 * 60 * 1000);

        let latitude;
        let longitude;
        let speedKmh;
        let heading;

        if (h === 0) {
          const start = randomPointInDistrict(boundary, bbox);
          latitude = Number.parseFloat(start.latitude.toFixed(6));
          longitude = Number.parseFloat(start.longitude.toFixed(6));
          speedKmh = Number.parseFloat(randomInRange(0, 15).toFixed(2));
          heading = Math.floor(randomInRange(0, 360));
        } else {
          const step = nextPingPosition(boundary, bbox, prevLat, prevLon, prevHeading);
          latitude = step.latitude;
          longitude = step.longitude;
          speedKmh = step.speedKmh;
          heading = step.heading;
        }

        prevLat = latitude;
        prevLon = longitude;
        prevHeading = heading;

        pings.push({
          tuk: item.tuk._id,
          latitude,
          longitude,
          pingedAt,
          speedKmh,
          heading,
          source: "simulated",
          point: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          resolvedDistrict: district._id,
          resolvedProvince
        });
      }
    }

    console.log(`Inserting ${pings.length} pings...`);
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
