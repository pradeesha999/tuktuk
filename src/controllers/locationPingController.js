// Location ping controller: ingest and query historical movement logs.
import District from "../models/District.js";
import LocationPing from "../models/LocationPing.js";
import Province from "../models/Province.js";

const pingPopulate = {
  path: "tuk",
  populate: [{ path: "district", populate: { path: "province" } }, { path: "policeStation" }]
};

const pingAreaPopulate = [
  { path: "resolvedDistrict", populate: { path: "province" } },
  { path: "resolvedProvince" }
];

const resolveAdministrativeArea = async (longitude, latitude) => {
  const point = {
    type: "Point",
    coordinates: [longitude, latitude]
  };

  const district = await District.findOne({
    boundary: { $geoIntersects: { $geometry: point } }
  })
    .select("_id province")
    .lean();

  if (district) {
    return {
      point,
      resolvedDistrict: district._id,
      resolvedProvince: district.province
    };
  }

  const province = await Province.findOne({
    boundary: { $geoIntersects: { $geometry: point } }
  })
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

// Get movement logs with tuk and geography filters.
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

    if (tukId) {
      filter.tuk = tukId;
    }

    const pings = await LocationPing.find(filter).populate([pingPopulate, ...pingAreaPopulate]).sort({ pingedAt: -1 });
    return res.json(pings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
