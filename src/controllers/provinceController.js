// Province controller: CRUD handlers for province resources.
import Province from "../models/Province.js";
import { mergeActive } from "../utils/softDelete.js";

const stripDeletedAt = (body) => {
  const copy = { ...body };
  delete copy.deletedAt;
  return copy;
};

// Create one province record.
export const createProvince = async (req, res) => {
  try {
    const province = await Province.create(req.body);
    res.status(201).json(province);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all provinces (active only).
export const getProvinces = async (req, res) => {
  try {
    const provinces = await Province.find(mergeActive()).sort({ name: 1 });
    return res.json(provinces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one province by Mongo id (active only).
export const getProvinceById = async (req, res) => {
  try {
    const province = await Province.findOne(mergeActive({ _id: req.params.id }));
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
