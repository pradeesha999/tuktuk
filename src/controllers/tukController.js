// Tuk controller: CRUD handlers for tuk resources.
import District from "../models/District.js";
import LocationPing from "../models/LocationPing.js";
import Tuk from "../models/Tuk.js";

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
    const tuk = await Tuk.create(req.body);
    const populated = await Tuk.findById(tuk._id).populate(populateTukGeo);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all tuks, with optional geography filters.
export const getTukTuks = async (req, res) => {
  try {
    const { districtId, provinceId, stationId } = req.query;
    const filter = {};

    if (districtId) {
      filter.district = districtId;
    }

    if (provinceId) {
      const districts = await District.find({ province: provinceId }).select("_id").lean();
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
    const tuk = await Tuk.findById(req.params.id).populate(populateTukGeo);
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
    const tuk = await Tuk.findById(req.params.id).populate(populateTukGeo);
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
      heading: ping.heading
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// Update one tuk by Mongo id.
export const updateTuk = async (req, res) => {
  try {
    const current = await Tuk.findById(req.params.id).populate(populateTukGeo);
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isTukAllowed(current, req.auth)) return res.status(403).json({ error: "Forbidden" });

    const updated = await Tuk.findByIdAndUpdate(req.params.id, req.body, {
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
    const current = await Tuk.findById(req.params.id).populate(populateTukGeo);
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isTukAllowed(current, req.auth)) return res.status(403).json({ error: "Forbidden" });

    const tuk = await Tuk.findByIdAndDelete(req.params.id);
    if (!tuk) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: tuk._id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};