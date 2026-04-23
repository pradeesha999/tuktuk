// Tuk controller: CRUD handlers for tuk resources.
import District from "../models/District.js";
import LocationPing from "../models/LocationPing.js";
import Tuk from "../models/Tuk.js";
import { sendConditionalJson } from "../utils/conditionalJson.js";
import { parsePagination, parseSort } from "../utils/queryOptions.js";

const populateTukGeo = [
  {
    path: "district",
    populate: { path: "province" }
  },
  {
    path: "policeStation",
    populate: {
      path: "district",
      populate: { path: "province" }
    }
  }
];

// Create one tuk record.
export const createTukTuk = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (!payload.district && payload.legacyDistrictName) {
      const district = await District.findOne({ name: payload.legacyDistrictName });
      if (district) {
        payload.district = district._id;
      }
    }

    const tuk = await Tuk.create(payload);
    const populated = await Tuk.findById(tuk._id).populate(populateTukGeo);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all tuks, with optional geography filters.
export const getTukTuks = async (req, res) => {
  try {
    const { districtId, provinceId, stationId, district } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const sort = parseSort(req.query, ["registrationNumber", "createdAt"], "createdAt");
    const filter = {};

    if (districtId) {
      filter.district = districtId;
    } else if (provinceId) {
      const districts = await District.find({ province: provinceId }).select("_id").lean();
      filter.district = { $in: districts.map((item) => item._id) };
    } else if (district) {
      filter.legacyDistrictName = district;
    }

    if (stationId) {
      filter.policeStation = stationId;
    }

    const [items, total] = await Promise.all([
      Tuk.find(filter).populate(populateTukGeo).sort(sort).skip(skip).limit(limit),
      Tuk.countDocuments(filter)
    ]);

    return sendConditionalJson(req, res, {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one tuk by Mongo id.
export const getTukById = async (req, res) => {
  try {
    const tuk = await Tuk.findById(req.params.id).populate(populateTukGeo);
    if (!tuk) return res.status(404).json({ error: "Not found" });
    res.json(tuk);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get last known location for one tuk.
export const getTukLastLocation = async (req, res) => {
  try {
    const tuk = await Tuk.findById(req.params.id);
    if (!tuk) return res.status(404).json({ error: "Not found" });

    const ping = await LocationPing.findOne({ tuk: tuk._id }).sort({ pingedAt: -1 });
    if (!ping) return res.status(404).json({ error: "No location data" });

    return res.json({
      tukId: tuk._id,
      latitude: ping.latitude,
      longitude: ping.longitude,
      pingedAt: ping.pingedAt,
      speedKmh: ping.speedKmh,
      heading: ping.heading
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// Update one tuk by Mongo id.
export const updateTuk = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (!payload.district && payload.legacyDistrictName) {
      const district = await District.findOne({ name: payload.legacyDistrictName });
      if (district) {
        payload.district = district._id;
      }
    }

    const updated = await Tuk.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    const tuk = await Tuk.findById(updated._id).populate(populateTukGeo);
    res.json(tuk);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete one tuk by Mongo id.
export const deleteTuk = async (req, res) => {
  try {
    const tuk = await Tuk.findByIdAndDelete(req.params.id);
    if (!tuk) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: tuk._id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};