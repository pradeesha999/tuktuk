// Province controller: CRUD handlers for province resources.
import Province from "../models/Province.js";
import { mergeActive, stripDeletedAt } from "../utils/softDelete.js";
import {
  parsePagination,
  parseSort,
  setPaginationHeaders
} from "../utils/queryOptions.js";

const PROVINCE_SORT_FIELDS = ["name", "code", "createdAt", "updatedAt"];

// Create one province record.
export const createProvince = async (req, res) => {
  try {
    const province = await Province.create(req.body);
    res.status(201).json(province);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all provinces (active only). Omits GeoJSON boundaries by default (large payloads break Swagger/clients).
export const getProvinces = async (req, res) => {
  try {
    const sort = parseSort(req.query.sort, PROVINCE_SORT_FIELDS, { name: 1 });
    const { skip, limit } = parsePagination(req.query);
    const filter = mergeActive();

    let query = Province.find(filter).sort(sort).skip(skip).limit(limit);
    if (req.query.includeBoundary !== "true") {
      query = query.select("-boundary");
    }

    const [provinces, total] = await Promise.all([
      query,
      Province.countDocuments(filter)
    ]);

    setPaginationHeaders(req, res, { total, skip, limit });
    return res.json(provinces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one province by Mongo id (active only).
export const getProvinceById = async (req, res) => {
  try {
    let query = Province.findOne(mergeActive({ _id: req.params.id }));
    if (req.query.includeBoundary !== "true") {
      query = query.select("-boundary");
    }
    const province = await query;
    if (!province) return res.status(404).json({ error: "Not found" });
    res.json(province);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update one province by Mongo id.
export const updateProvince = async (req, res) => {
  try {
    const payload = stripDeletedAt(req.body);
    const province = await Province.findOneAndUpdate(mergeActive({ _id: req.params.id }), payload, {
      new: true,
      runValidators: true
    });
    if (!province) return res.status(404).json({ error: "Not found" });
    res.json(province);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Soft-delete one province by Mongo id.
export const deleteProvince = async (req, res) => {
  try {
    const province = await Province.findOneAndUpdate(
      mergeActive({ _id: req.params.id }),
      { deletedAt: new Date() },
      { new: true }
    );
    if (!province) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: province._id, deletedAt: province.deletedAt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
