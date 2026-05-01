// Location ping controller: ingest and query historical movement logs.
import District from "../models/District.js";
import LocationPing from "../models/LocationPing.js";
import Province from "../models/Province.js";
import Tuk from "../models/Tuk.js";
import { mergeActive } from "../utils/softDelete.js";

const pingPopulate = {
  path: "tuk",
  match: { deletedAt: null },
  populate: [
    { path: "district", match: { deletedAt: null }, populate: { path: "province", match: { deletedAt: null } } },
    { path: "policeStation", match: { deletedAt: null } }
  ]
};

const pingAreaPopulate = [
  { path: "resolvedDistrict", populate: { path: "province", match: { deletedAt: null } } },
  { path: "resolvedProvince", match: { deletedAt: null } }
];

const resolveAdministrativeArea = async (longitude, latitude) => {
  const point = {
    type: "Point",
    coordinates: [longitude, latitude]
  };

  const district = await District.findOne(
    mergeActive({
      boundary: { $geoIntersects: { $geometry: point } }
    })
  )
    .select("_id province")
    .lean();

  if (district) {
    return {
      point,
      resolvedDistrict: district._id,
      resolvedProvince: district.province
    };
  }

  const province = await Province.findOne(
    mergeActive({
      boundary: { $geoIntersects: { $geometry: point } }
    })
  )
    .select("_id")
    .lean();

  return {
    point,
    resolvedDistrict: null,
    resolvedProvince: province?._id || null
  };
};

// Create one location ping record.
export const createLocationPing = async (req, res) => {
  try {
    const tukAlive = await Tuk.findOne(mergeActive({ _id: req.body.tuk }));
    if (!tukAlive) return res.status(404).json({ error: "Tuk not found or inactive" });

    const area = await resolveAdministrativeArea(req.body.longitude, req.body.latitude);
    const ping = await LocationPing.create({
      ...req.body,
      point: area.point,
      resolvedDistrict: area.resolvedDistrict,
      resolvedProvince: area.resolvedProvince
    });
    const populated = await LocationPing.findById(ping._id).populate([pingPopulate, ...pingAreaPopulate]);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get movement logs with tuk and geography filters (pings for active tuks only).
export const getLocationPings = async (req, res) => {
  try {
    const { tukId, districtId, provinceId, from, to } = req.query;
    const filter = {};

    if (from || to) {
      filter.pingedAt = {};
      if (from) filter.pingedAt.$gte = new Date(from);
      if (to) filter.pingedAt.$lte = new Date(to);
    }

    if (districtId) {
      filter.resolvedDistrict = districtId;
    }

    if (provinceId) {
      filter.resolvedProvince = provinceId;
    }

    const activeTuks = await Tuk.find(mergeActive()).select("_id").lean();
    const activeIds = activeTuks.map((t) => t._id);
    if (activeIds.length === 0) {
      return res.json([]);
    }

    if (tukId) {
      const allowed = activeIds.some((id) => String(id) === String(tukId));
      if (!allowed) return res.json([]);
      filter.tuk = tukId;
    } else {
      filter.tuk = { $in: activeIds };
    }

    const pings = await LocationPing.find(filter).populate([pingPopulate, ...pingAreaPopulate]).sort({ pingedAt: -1 });
    return res.json(pings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
