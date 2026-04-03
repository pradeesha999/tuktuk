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

export const getTukById = async (req, res) => {
  try {
    const tuk = await Tuk.findById(req.params.id);
    if (!tuk) return res.status(404).json({ error: "Not found" });
    res.json(tuk);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

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

export const deleteTuk = async (req, res) => {
  try {
    const tuk = await Tuk.findByIdAndDelete(req.params.id);
    if (!tuk) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: tuk._id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};