// Location ping controller: ingest and query historical movement logs.
import District from "../models/District.js";
import LocationPing from "../models/LocationPing.js";
import Tuk from "../models/Tuk.js";
import { sendConditionalJson } from "../utils/conditionalJson.js";
import { parsePagination, parseSort } from "../utils/queryOptions.js";

const pingPopulate = {
  path: "tuk",
  populate: [{ path: "district", populate: { path: "province" } }, { path: "policeStation" }]
};

// Create one location ping record.
export const createLocationPing = async (req, res) => {
  try {
    const ping = await LocationPing.create(req.body);
    const populated = await LocationPing.findById(ping._id).populate(pingPopulate);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get movement logs with tuk and geography filters.
export const getLocationPings = async (req, res) => {
  try {
    const { tukId, districtId, provinceId, from, to } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const sort = parseSort(req.query, ["pingedAt", "createdAt"], "pingedAt");
    const filter = {};

    if (from || to) {
      filter.pingedAt = {};
      if (from) filter.pingedAt.$gte = new Date(from);
      if (to) filter.pingedAt.$lte = new Date(to);
    }

    if (tukId) {
      filter.tuk = tukId;
    } else if (districtId || provinceId) {
      const tukFilter = {};
      if (districtId) {
        tukFilter.district = districtId;
      } else if (provinceId) {
        const districts = await District.find({ province: provinceId }).select("_id").lean();
        tukFilter.district = { $in: districts.map((item) => item._id) };
      }

      const tuks = await Tuk.find(tukFilter).select("_id").lean();
      filter.tuk = { $in: tuks.map((item) => item._id) };
    }

    const [items, total] = await Promise.all([
      LocationPing.find(filter).populate(pingPopulate).sort(sort).skip(skip).limit(limit),
      LocationPing.countDocuments(filter)
    ]);

    return sendConditionalJson(req, res, {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
