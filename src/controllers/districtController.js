// District controller: CRUD handlers for district resources.
import District from "../models/District.js";
import Province from "../models/Province.js";
import { mergeActive, stripDeletedAt } from "../utils/softDelete.js";
import { populateProvinceCompact } from "../utils/geoResponse.js";
import {
  parsePagination,
  parseSort,
  setPaginationHeaders
} from "../utils/queryOptions.js";

const DISTRICT_SORT_FIELDS = ["name", "code", "createdAt", "updatedAt"];

// Create one district record.
export const createDistrict = async (req, res) => {
  try {
    const provinceOk = await Province.findOne(mergeActive({ _id: req.body.province }));
    if (!provinceOk) return res.status(400).json({ error: "Province not found or inactive" });

    const district = await District.create(req.body);
    const populated = await District.findOne(mergeActive({ _id: district._id })).populate(populateProvinceCompact);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all districts, optional filter ?provinceId=<Province _id>.
export const getDistricts = async (req, res) => {
  try {
    const { provinceId } = req.query;
    const filter = provinceId ? mergeActive({ province: provinceId }) : mergeActive();

    const sort = parseSort(req.query.sort, DISTRICT_SORT_FIELDS, { name: 1 });
    const { skip, limit } = parsePagination(req.query);

    let query = District.find(filter)
      .populate(populateProvinceCompact)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    if (req.query.includeBoundary !== "true") {
      query = query.select("-boundary");
    }

    const [districts, total] = await Promise.all([
      query,
      District.countDocuments(filter)
    ]);

    setPaginationHeaders(req, res, { total, skip, limit });
    return res.json(districts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one district by Mongo id.
export const getDistrictById = async (req, res) => {
  try {
    let query = District.findOne(mergeActive({ _id: req.params.id })).populate(populateProvinceCompact);
    if (req.query.includeBoundary !== "true") {
      query = query.select("-boundary");
    }
    const district = await query;
    if (!district) return res.status(404).json({ error: "Not found" });
    res.json(district);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update one district by Mongo id.
export const updateDistrict = async (req, res) => {
  try {
    if (req.body.province) {
      const provinceOk = await Province.findOne(mergeActive({ _id: req.body.province }));
      if (!provinceOk) return res.status(400).json({ error: "Province not found or inactive" });
    }

    const payload = stripDeletedAt(req.body);
    const updated = await District.findOneAndUpdate(mergeActive({ _id: req.params.id }), payload, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    const district = await District.findOne(mergeActive({ _id: updated._id })).populate(populateProvinceCompact);
    res.json(district);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Soft-delete one district by Mongo id.
export const deleteDistrict = async (req, res) => {
  try {
    const district = await District.findOneAndUpdate(
      mergeActive({ _id: req.params.id }),
      { deletedAt: new Date() },
      { new: true }
    );
    if (!district) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: district._id, deletedAt: district.deletedAt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
