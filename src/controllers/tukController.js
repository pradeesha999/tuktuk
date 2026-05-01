// Tuk controller: CRUD handlers for tuk resources.
import mongoose from "mongoose";
import District from "../models/District.js";
import LocationPing from "../models/LocationPing.js";
import PoliceStation from "../models/PoliceStation.js";
import Tuk from "../models/Tuk.js";
import { activeTukDocMatch, mergeActive } from "../utils/softDelete.js";

const stripDeletedAt = (body) => {
  const copy = { ...body };
  delete copy.deletedAt;
  return copy;
};

const populateTukGeo = [
  {
    path: "district",
    match: { deletedAt: null },
    populate: { path: "province", match: { deletedAt: null } }
  },
  {
    path: "policeStation",
    match: { deletedAt: null },
    populate: {
      path: "district",
      match: { deletedAt: null },
      populate: { path: "province", match: { deletedAt: null } }
    }
  }
];

const isTukAllowed = (tuk, auth) => {
  if (!auth || auth.role === "HQ_ADMIN") return true;
  if (auth.role === "PROVINCE_ADMIN") {
    return String(tuk?.district?.province?._id || tuk?.district?.province) === String(auth.provinceId);
  }
  if (auth.role === "DISTRICT_OFFICER") {
    return String(tuk?.district?._id || tuk?.district) === String(auth.districtId);
  }
  if (auth.role === "STATION_OFFICER") {
    return String(tuk?.policeStation?._id || tuk?.policeStation) === String(auth.stationId);
  }
  return false;
};

// Create one tuk record.
export const createTukTuk = async (req, res) => {
  try {
    const districtOk = await District.findOne(mergeActive({ _id: req.body.district }));
    if (!districtOk) return res.status(400).json({ error: "District not found or inactive" });

    if (req.body.policeStation) {
      const stationOk = await PoliceStation.findOne(mergeActive({ _id: req.body.policeStation }));
      if (!stationOk) return res.status(400).json({ error: "Police station not found or inactive" });
    }

    const tuk = await Tuk.create(req.body);
    const populated = await Tuk.findOne(mergeActive({ _id: tuk._id })).populate(populateTukGeo);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all tuks, with optional geography filters (active tuks only).
export const getTukTuks = async (req, res) => {
  try {
    const { districtId, provinceId, stationId } = req.query;
    const filter = mergeActive();

    if (districtId) {
      filter.district = districtId;
    }

    if (provinceId) {
      const districts = await District.find(mergeActive({ province: provinceId })).select("_id").lean();
      filter.district = { $in: districts.map((item) => item._id) };
    }

    if (stationId) {
      filter.policeStation = stationId;
    }

    const tuks = await Tuk.find(filter).populate(populateTukGeo).sort({ createdAt: -1 });
    return res.json(tuks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one tuk by Mongo id.
export const getTukById = async (req, res) => {
  try {
    const tuk = await Tuk.findOne(mergeActive({ _id: req.params.id })).populate(populateTukGeo);
    if (!tuk) return res.status(404).json({ error: "Not found" });
    if (!isTukAllowed(tuk, req.auth)) return res.status(403).json({ error: "Forbidden" });
    res.json(tuk);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get last known location for one tuk.
export const getTukLastLocation = async (req, res) => {
  try {
    const tuk = await Tuk.findOne(mergeActive({ _id: req.params.id })).populate(populateTukGeo);
    if (!tuk) return res.status(404).json({ error: "Not found" });
    if (!isTukAllowed(tuk, req.auth)) return res.status(403).json({ error: "Forbidden" });

    const ping = await LocationPing.findOne({ tuk: tuk._id }).sort({ pingedAt: -1 });
    if (!ping) return res.status(404).json({ error: "No location data" });

    return res.json({
      tukId: tuk._id,
      latitude: ping.latitude,
      longitude: ping.longitude,
      pingedAt: ping.pingedAt,
      speedKmh: ping.speedKmh,
      heading: ping.heading,
      resolvedDistrict: ping.resolvedDistrict || null,
      resolvedProvince: ping.resolvedProvince || null
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// Get latest known area (resolved from GeoJSON) per tuk, only if last ping is recent.
export const getTuksCurrentArea = async (req, res) => {
  try {
    const { provinceId, districtId } = req.query;

    const defaultAge = Number.parseInt(process.env.CURRENT_AREA_MAX_AGE_MINUTES || "60", 10);
    const rawMax = req.query.maxAgeMinutes;
    const maxAgeMinutes =
      rawMax === undefined || rawMax === "" ? defaultAge : Number.parseInt(String(rawMax), 10);
    if (!Number.isFinite(maxAgeMinutes) || maxAgeMinutes < 1) {
      return res.status(400).json({ error: "maxAgeMinutes must be a positive number" });
    }

    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const pingFilter = { pingedAt: { $gte: cutoff } };

    if (provinceId) {
      if (!mongoose.isValidObjectId(provinceId)) return res.status(400).json({ error: "Invalid provinceId" });
      pingFilter.resolvedProvince = new mongoose.Types.ObjectId(provinceId);
    }
    if (districtId) {
      if (!mongoose.isValidObjectId(districtId)) return res.status(400).json({ error: "Invalid districtId" });
      pingFilter.resolvedDistrict = new mongoose.Types.ObjectId(districtId);
    }

    const stationScope = req.geoScope?.restrictToStationId;
    if (stationScope && !mongoose.isValidObjectId(stationScope)) {
      return res.status(400).json({ error: "Invalid station scope" });
    }

    const pipeline = [
      { $match: pingFilter },
      { $sort: { pingedAt: -1 } },
      { $group: { _id: "$tuk", ping: { $first: "$$ROOT" } } },
      {
        $lookup: {
          from: "tuks",
          localField: "_id",
          foreignField: "_id",
          as: "tuk"
        }
      },
      { $unwind: "$tuk" },
      { $match: activeTukDocMatch }
    ];

    if (stationScope) {
      pipeline.push({
        $match: { "tuk.policeStation": new mongoose.Types.ObjectId(stationScope) }
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: "districts",
          localField: "ping.resolvedDistrict",
          foreignField: "_id",
          as: "resolvedDistrict"
        }
      },
      {
        $lookup: {
          from: "provinces",
          localField: "ping.resolvedProvince",
          foreignField: "_id",
          as: "resolvedProvince"
        }
      },
      {
        $project: {
          _id: 0,
          tukId: "$tuk._id",
          registrationNumber: "$tuk.registrationNumber",
          pingedAt: "$ping.pingedAt",
          latitude: "$ping.latitude",
          longitude: "$ping.longitude",
          resolvedDistrict: { $arrayElemAt: ["$resolvedDistrict", 0] },
          resolvedProvince: { $arrayElemAt: ["$resolvedProvince", 0] }
        }
      }
    );

    const latest = await LocationPing.aggregate(pipeline);
    return res.json(latest);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Update one tuk by Mongo id.
export const updateTuk = async (req, res) => {
  try {
    const current = await Tuk.findOne(mergeActive({ _id: req.params.id })).populate(populateTukGeo);
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isTukAllowed(current, req.auth)) return res.status(403).json({ error: "Forbidden" });

    if (req.body.district) {
      const districtOk = await District.findOne(mergeActive({ _id: req.body.district }));
      if (!districtOk) return res.status(400).json({ error: "District not found or inactive" });
    }
    if (req.body.policeStation) {
      const stationOk = await PoliceStation.findOne(mergeActive({ _id: req.body.policeStation }));
      if (!stationOk) return res.status(400).json({ error: "Police station not found or inactive" });
    }

    const payload = stripDeletedAt(req.body);
    const updated = await Tuk.findOneAndUpdate(mergeActive({ _id: req.params.id }), payload, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    const tuk = await Tuk.findOne(mergeActive({ _id: updated._id })).populate(populateTukGeo);
    res.json(tuk);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Soft-delete one tuk by Mongo id.
export const deleteTuk = async (req, res) => {
  try {
    const current = await Tuk.findOne(mergeActive({ _id: req.params.id })).populate(populateTukGeo);
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isTukAllowed(current, req.auth)) return res.status(403).json({ error: "Forbidden" });

    const tuk = await Tuk.findOneAndUpdate(
      mergeActive({ _id: req.params.id }),
      { deletedAt: new Date() },
      { new: true }
    );
    if (!tuk) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: tuk._id, deletedAt: tuk.deletedAt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
