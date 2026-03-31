import Tuk from "../models/Tuk.js";

export const createTukTuk = async (req, res) => {
  try {
    const tuk = await Tuk.create(req.body);
    res.status(201).json(tuk);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getTukTuks = async (req, res) => {
  try {
    const { district } = req.query;

    let filter = {};
    if (district) filter.district = district;

    const tuks = await Tuk.find(filter);
    res.json(tuks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};