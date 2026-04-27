import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getAuthUsers } from "../config/authUsers.js";
import User from "../models/User.js";

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const getJwtConfig = () => ({
  secret: getRequiredEnv("JWT_SECRET"),
  expiresIn: process.env.JWT_EXPIRES_IN || "12h"
});

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const dbUser = await User.findOne({ username }).lean();
    let user = null;

    if (dbUser && (await bcrypt.compare(password, dbUser.passwordHash))) {
      user = {
        username: dbUser.username,
        role: dbUser.role,
        provinceId: dbUser.provinceId || null,
        districtId: dbUser.districtId || null,
        stationId: dbUser.stationId || null,
        tukId: dbUser.tukId || null
      };
    } else {
      const users = getAuthUsers();
      user = users.find((item) => item.username === username && item.password === password) || null;
    }

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

    const { secret, expiresIn } = getJwtConfig();
    const token = jwt.sign(payload, secret, { expiresIn });
    return res.json({ token, user: payload });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { username, password, role, provinceId = null, districtId = null, stationId = null, tukId = null } = req.body;

    const reserved = getAuthUsers().some((item) => item.username === username);
    if (reserved) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const existing = await User.findOne({ username }).lean();
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await User.create({
      username,
      passwordHash,
      role,
      provinceId,
      districtId,
      stationId,
      tukId
    });

    return res.status(201).json({
      id: created._id,
      username: created.username,
      role: created.role,
      provinceId: created.provinceId,
      districtId: created.districtId,
      stationId: created.stationId,
      tukId: created.tukId
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
