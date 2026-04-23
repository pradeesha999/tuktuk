// Police station controller: CRUD + filters for district / province scope.
import District from "../models/District.js";
import PoliceStation from "../models/PoliceStation.js";
import { sendConditionalJson } from "../utils/conditionalJson.js";
import { parsePagination, parseSort } from "../utils/queryOptions.js";

const populateDistrictProvince = {
  path: "district",
  populate: { path: "province" }
};

// Create one police station record.
export const createPoliceStation = async (req, res) => {
  try {
    const station = await PoliceStation.create(req.body);
    const populated = await PoliceStation.findById(station._id).populate(populateDistrictProvince);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all stations. Optional: ?districtId=  ?provinceId=
export const getPoliceStations = async (req, res) => {
  try {
    const { districtId, provinceId } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const sort = parseSort(req.query, ["name", "code", "createdAt"], "name");
    let filter = {};

    if (districtId) {
      filter.district = districtId;
    } else if (provinceId) {
      const districts = await District.find({ province: provinceId }).select("_id").lean();
      const ids = districts.map((d) => d._id);
      filter.district = { $in: ids };
    }

    const [items, total] = await Promise.all([
      PoliceStation.find(filter)
        .populate(populateDistrictProvince)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      PoliceStation.countDocuments(filter)
    ]);

    return sendConditionalJson(req, res, {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one police station by Mongo id.
export const getPoliceStationById = async (req, res) => {
  try {
    const station = await PoliceStation.findById(req.params.id).populate(populateDistrictProvince);
    if (!station) return res.status(404).json({ error: "Not found" });
    res.json(station);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update one police station by Mongo id.
export const updatePoliceStation = async (req, res) => {
  try {
    const updated = await PoliceStation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    const station = await PoliceStation.findById(updated._id).populate(populateDistrictProvince);
    res.json(station);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete one police station by Mongo id.
export const deletePoliceStation = async (req, res) => {
  try {
    const station = await PoliceStation.findByIdAndDelete(req.params.id);
    if (!station) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: station._id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
