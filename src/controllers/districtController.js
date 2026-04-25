// District controller: CRUD handlers for district resources.
import District from "../models/District.js";

// Create one district record.
export const createDistrict = async (req, res) => {
  try {
    const district = await District.create(req.body);
    const populated = await District.findById(district._id).populate("province");
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all districts, optional filter ?provinceId=<Province _id>.
export const getDistricts = async (req, res) => {
  try {
    const { provinceId } = req.query;
    const filter = provinceId ? { province: provinceId } : {};
    const districts = await District.find(filter).populate("province").sort({ name: 1 });
    return res.json(districts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one district by Mongo id.
export const getDistrictById = async (req, res) => {
  try {
    const district = await District.findById(req.params.id).populate("province");
    if (!district) return res.status(404).json({ error: "Not found" });
    res.json(district);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update one district by Mongo id.
export const updateDistrict = async (req, res) => {
  try {
    const updated = await District.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    const district = await District.findById(updated._id).populate("province");
    res.json(district);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete one district by Mongo id.
export const deleteDistrict = async (req, res) => {
  try {
    const district = await District.findByIdAndDelete(req.params.id);
    if (!district) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: district._id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
