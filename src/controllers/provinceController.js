// Province controller: CRUD handlers for province resources.
import Province from "../models/Province.js";

// Create one province record.
export const createProvince = async (req, res) => {
  try {
    const province = await Province.create(req.body);
    res.status(201).json(province);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all provinces.
export const getProvinces = async (req, res) => {
  try {
    const provinces = await Province.find().sort({ name: 1 });
    res.json(provinces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one province by Mongo id.
export const getProvinceById = async (req, res) => {
  try {
    const province = await Province.findById(req.params.id);
    if (!province) return res.status(404).json({ error: "Not found" });
    res.json(province);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update one province by Mongo id.
export const updateProvince = async (req, res) => {
  try {
    const province = await Province.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!province) return res.status(404).json({ error: "Not found" });
    res.json(province);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete one province by Mongo id.
export const deleteProvince = async (req, res) => {
  try {
    const province = await Province.findByIdAndDelete(req.params.id);
    if (!province) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: province._id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
