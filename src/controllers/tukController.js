import TukTuk from "../models/TukTuk.js";

// Create TukTuk
export const createTukTuk = async (req, res) => {
  try {
    const tuk = await TukTuk.create(req.body);
    res.status(201).json(tuk);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all TukTuks (with filtering)
export const getTukTuks = async (req, res) => {
  try {
    const { district } = req.query;

    let filter = {};
    if (district) filter.district = district;

    const tuks = await TukTuk.find(filter);
    res.json(tuks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};