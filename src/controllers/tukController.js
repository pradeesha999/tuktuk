// Tuk controller: CRUD handlers for tuk resources.
import mongoose from "mongoose";
import District from "../models/District.js";
import LocationPing from "../models/LocationPing.js";
import PoliceStation from "../models/PoliceStation.js";
import Tuk from "../models/Tuk.js";
import { activeTukDocMatch, mergeActive, stripDeletedAt } from "../utils/softDelete.js";
import { populateTukGeoCompact as populateTukGeo } from "../utils/geoResponse.js";
import {
  buildPingVisibilityClause,
  homeTukIdStrings,
  isHomeTukDoc
} from "../utils/jurisdictionPingScope.js";
import { getEffectiveDistrictId } from "../middleware/authMiddleware.js";
import {
  parsePagination,
  parseSort,
  setPaginationHeaders
} from "../utils/queryOptions.js";

const TUK_SORT_FIELDS = ["registrationNumber", "deviceId", "createdAt", "updatedAt"];

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

    const sort = parseSort(req.query.sort, TUK_SORT_FIELDS, { createdAt: -1 });
    const { skip, limit } = parsePagination(req.query);

    const [tuks, total] = await Promise.all([
      Tuk.find(filter)
        .populate(populateTukGeo)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Tuk.countDocuments(filter)
    ]);

    setPaginationHeaders(req, res, { total, skip, limit });
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
    if (isHomeTukDoc(tuk, req.auth)) {
      return res.json(tuk);
    }
    if (["PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"].includes(req.auth?.role)) {
      return res.json({
        _id: tuk._id,
        registrationNumber: tuk.registrationNumber,
        scope: "outside_home_jurisdiction"
      });
    }
    return res.status(403).json({ error: "Forbidden" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get last known location for one tuk (home admins see latest ping anywhere; others only while ping resolves inside their province/district).
export const getTukLastLocation = async (req, res) => {
  try {
    const tuk = await Tuk.findOne(mergeActive({ _id: req.params.id })).populate(populateTukGeo);
    if (!tuk) return res.status(404).json({ error: "Not found" });

    const jsonBody = (ping) => ({
      tukId: tuk._id,
      latitude: ping.latitude,
      longitude: ping.longitude,
      pingedAt: ping.pingedAt,
      speedKmh: ping.speedKmh,
      heading: ping.heading,
      resolvedDistrict: ping.resolvedDistrict || null,
      resolvedProvince: ping.resolvedProvince || null
    });

    if (isHomeTukDoc(tuk, req.auth)) {
      const ping = await LocationPing.findOne({ tuk: tuk._id }).sort({ pingedAt: -1 });
      if (!ping) return res.status(404).json({ error: "No location data" });
      return res.json(jsonBody(ping));
    }

    const auth = req.auth;
    let ping = null;

    if (auth.role === "DISTRICT_OFFICER" && auth.districtId) {
      ping = await LocationPing.findOne({
        tuk: tuk._id,
        resolvedDistrict: auth.districtId
      }).sort({ pingedAt: -1 });
    } else if (auth.role === "PROVINCE_ADMIN" && auth.provinceId) {
      ping = await LocationPing.findOne({
        tuk: tuk._id,
        resolvedProvince: auth.provinceId
      }).sort({ pingedAt: -1 });
    } else if (auth.role === "STATION_OFFICER") {
      const eff = await getEffectiveDistrictId(auth);
      if (eff) {
        ping = await LocationPing.findOne({
          tuk: tuk._id,
          resolvedDistrict: eff
        }).sort({ pingedAt: -1 });
      }
    }

    if (!ping) {
      return res.status(404).json({ error: "No location data in your jurisdiction for this tuk" });
    }
    return res.json(jsonBody(ping));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// Tuks with their most recent ping (within max age), resolved district/province from GeoJSON — excludes stale tracks as time passes.
export const getTuksLastPingArea = async (req, res) => {
  try {
    const auth = req.auth;
    const { provinceId, districtId } = req.query;

    const envMinutes =
      process.env.LAST_PING_AREA_MAX_AGE_MINUTES || process.env.CURRENT_AREA_MAX_AGE_MINUTES || "60";
    const defaultAge = Number.parseInt(envMinutes, 10);
    const rawMax = req.query.maxAgeMinutes;
    const maxAgeMinutes =
      rawMax === undefined || rawMax === "" ? defaultAge : Number.parseInt(String(rawMax), 10);
    if (!Number.isFinite(maxAgeMinutes) || maxAgeMinutes < 1) {
      return res.status(400).json({ error: "maxAgeMinutes must be a positive number" });
    }

    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const matchParts = [{ pingedAt: { $gte: cutoff } }];

    if (auth.role === "HQ_ADMIN") {
      if (provinceId) {
        if (!mongoose.isValidObjectId(provinceId)) return res.status(400).json({ error: "Invalid provinceId" });
        matchParts.push({ resolvedProvince: new mongoose.Types.ObjectId(provinceId) });
      }
      if (districtId) {
        if (!mongoose.isValidObjectId(districtId)) return res.status(400).json({ error: "Invalid districtId" });
        matchParts.push({ resolvedDistrict: new mongoose.Types.ObjectId(districtId) });
      }
    } else {
      const vis = await buildPingVisibilityClause(auth);
      if (vis) {
        matchParts.push(vis);
      }
    }

    const pingMatch = matchParts.length === 1 ? matchParts[0] : { $and: matchParts };

    const pipeline = [
      { $match: pingMatch },
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
      { $match: activeTukDocMatch },
      {
        $lookup: {
          from: "districts",
          let: { did: "$ping.resolvedDistrict" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$did"] } } },
            { $project: { boundary: 0 } }
          ],
          as: "resolvedDistrict"
        }
      },
      {
        $lookup: {
          from: "provinces",
          let: { pid: "$ping.resolvedProvince" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$pid"] } } },
            { $project: { boundary: 0 } }
          ],
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
    ];

    const latest = await LocationPing.aggregate(pipeline);

    if (!auth || auth.role === "HQ_ADMIN") {
      return res.json(latest);
    }

    const homeSet = await homeTukIdStrings(auth);
    const trimmed = latest.map((row) => {
      const tid = String(row.tukId);
      if (homeSet && homeSet.has(tid)) return row;
      return {
        tukId: row.tukId,
        registrationNumber: row.registrationNumber,
        pingedAt: row.pingedAt,
        latitude: row.latitude,
        longitude: row.longitude,
        resolvedDistrict: row.resolvedDistrict
          ? { _id: row.resolvedDistrict._id, name: row.resolvedDistrict.name, code: row.resolvedDistrict.code }
          : null,
        resolvedProvince: row.resolvedProvince
          ? { _id: row.resolvedProvince._id, name: row.resolvedProvince.name, code: row.resolvedProvince.code }
          : null,
        scope: "transit_in_jurisdiction"
      };
    });

    return res.json(trimmed);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Update one tuk by Mongo id.
export const updateTuk = async (req, res) => {
  try {
    const current = await Tuk.findOne(mergeActive({ _id: req.params.id })).populate(populateTukGeo);
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isHomeTukDoc(current, req.auth)) return res.status(403).json({ error: "Forbidden" });

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
    if (!isHomeTukDoc(current, req.auth)) return res.status(403).json({ error: "Forbidden" });

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
