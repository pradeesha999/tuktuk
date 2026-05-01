// Police station controller: CRUD + filters for district / province scope.
import District from "../models/District.js";
import PoliceStation from "../models/PoliceStation.js";
import { mergeActive, stripDeletedAt } from "../utils/softDelete.js";
import { populateDistrictProvinceCompact } from "../utils/geoResponse.js";
import {
  parsePagination,
  parseSort,
  setPaginationHeaders
} from "../utils/queryOptions.js";

const STATION_SORT_FIELDS = ["name", "code", "createdAt", "updatedAt"];

// Create one police station record.
export const createPoliceStation = async (req, res) => {
  try {
    const districtOk = await District.findOne(mergeActive({ _id: req.body.district }));
    if (!districtOk) return res.status(400).json({ error: "District not found or inactive" });

    const station = await PoliceStation.create(req.body);
    const populated = await PoliceStation.findOne(mergeActive({ _id: station._id })).populate(populateDistrictProvinceCompact);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all stations. Optional: ?districtId=  ?provinceId=
export const getPoliceStations = async (req, res) => {
  try {
    const { districtId, provinceId } = req.query;
    const filter = {};

    if (districtId) {
      filter.district = districtId;
    } else if (provinceId) {
      const districts = await District.find(mergeActive({ province: provinceId })).select("_id").lean();
      const ids = districts.map((d) => d._id);
      filter.district = { $in: ids };
    }

    const finalFilter = mergeActive(filter);
    const sort = parseSort(req.query.sort, STATION_SORT_FIELDS, { name: 1 });
    const { skip, limit } = parsePagination(req.query);

    const [stations, total] = await Promise.all([
      PoliceStation.find(finalFilter)
        .populate(populateDistrictProvinceCompact)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      PoliceStation.countDocuments(finalFilter)
    ]);

    setPaginationHeaders(req, res, { total, skip, limit });
    return res.json(stations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one police station by Mongo id.
export const getPoliceStationById = async (req, res) => {
  try {
    const station = await PoliceStation.findOne(mergeActive({ _id: req.params.id })).populate(populateDistrictProvinceCompact);
    if (!station) return res.status(404).json({ error: "Not found" });
    res.json(station);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update one police station by Mongo id.
export const updatePoliceStation = async (req, res) => {
  try {
    if (req.body.district) {
      const districtOk = await District.findOne(mergeActive({ _id: req.body.district }));
      if (!districtOk) return res.status(400).json({ error: "District not found or inactive" });
    }

    const payload = stripDeletedAt(req.body);
    const updated = await PoliceStation.findOneAndUpdate(mergeActive({ _id: req.params.id }), payload, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    const station = await PoliceStation.findOne(mergeActive({ _id: updated._id })).populate(populateDistrictProvinceCompact);
    res.json(station);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Soft-delete one police station by Mongo id.
export const deletePoliceStation = async (req, res) => {
  try {
    const station = await PoliceStation.findOneAndUpdate(
      mergeActive({ _id: req.params.id }),
      { deletedAt: new Date() },
      { new: true }
    );
    if (!station) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: station._id, deletedAt: station.deletedAt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
