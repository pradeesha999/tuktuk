// Tuk controller: CRUD handlers for tuk resources.
import Tuk from "../models/Tuk.js";

// Create one tuk record.
export const createTukTuk = async (req, res) => {
  try {
    const tuk = await Tuk.create(req.body);
    res.status(201).json(tuk);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all tuks, optionally filtered by district.
export const getTukTuks = async (req, res) => {
  try {
    const { district } = req.query;
    const filter = district ? { district } : {};

    const tuks = await Tuk.find(filter);
    res.json(tuks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get one tuk by Mongo id.
export const getTukById = async (req, res) => {
  try {
    const tuk = await Tuk.findById(req.params.id);
    if (!tuk) return res.status(404).json({ error: "Not found" });
    res.json(tuk);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update one tuk by Mongo id.
export const updateTuk = async (req, res) => {
  try {
    const tuk = await Tuk.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!tuk) return res.status(404).json({ error: "Not found" });
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