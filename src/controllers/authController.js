import jwt from "jsonwebtoken";
import { getAuthUsers } from "../config/authUsers.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = getAuthUsers();
    const user = users.find((item) => item.username === username && item.password === password);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const payload = {
      username: user.username,
      role: user.role,
      provinceId: user.provinceId || null,
      districtId: user.districtId || null,
      stationId: user.stationId || null,
      tukId: user.tukId || null
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token, user: payload });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
