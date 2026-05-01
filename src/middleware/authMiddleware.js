import jwt from "jsonwebtoken";
import PoliceStation from "../models/PoliceStation.js";
import Tuk from "../models/Tuk.js";
import { mergeActive } from "../utils/softDelete.js";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
};

/** District for RBAC: JWT `districtId`, else station's district for `STATION_OFFICER`. */
export const getEffectiveDistrictId = async (auth) => {
  if (auth.districtId) return auth.districtId;
  if (auth.role === "STATION_OFFICER" && auth.stationId) {
    const ps = await PoliceStation.findById(auth.stationId).select("district").lean();
    return ps?.district ?? null;
  }
  return null;
};

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    req.auth = jwt.verify(token, getJwtSecret());
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!roles.includes(req.auth.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
};

/** Officers cannot spoof pings for tuks outside their jurisdiction (DEVICE/HQ skip). */
export const enforcePingWriteScope = async (req, res, next) => {
  const auth = req.auth;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  if (auth.role === "HQ_ADMIN" || auth.role === "DEVICE") return next();

  const tukId = req.body.tuk;
  if (!tukId) return res.status(400).json({ error: "tuk is required" });

  const tuk = await Tuk.findOne(mergeActive({ _id: tukId }))
    .populate({ path: "district", populate: { path: "province" } })
    .lean();
  if (!tuk) return res.status(404).json({ error: "Tuk not found" });

  if (auth.role === "PROVINCE_ADMIN") {
    if (!auth.provinceId) return res.status(403).json({ error: "Forbidden" });
    const pid = tuk.district?.province?._id || tuk.district?.province;
    if (!tuk.district || !pid || String(pid) !== String(auth.provinceId)) return res.status(403).json({ error: "Forbidden" });
    return next();
  }

  if (auth.role === "DISTRICT_OFFICER") {
    const eff = await getEffectiveDistrictId(auth);
    if (!eff || !tuk.district || String(tuk.district._id) !== String(eff)) return res.status(403).json({ error: "Forbidden" });
    return next();
  }

  if (auth.role === "STATION_OFFICER") {
    if (!auth.stationId) return res.status(403).json({ error: "Forbidden" });
    if (!tuk.policeStation || String(tuk.policeStation) !== String(auth.stationId)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  }

  return next();
};

export const applyScope = (resource, action) => async (req, res, next) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { role, provinceId, districtId, stationId, tukId } = req.auth;

  if (role === "HQ_ADMIN") {
    return next();
  }

  if (resource === "tuk") {
    if (action === "list") {
      if (role === "PROVINCE_ADMIN" && provinceId) req.query.provinceId = provinceId;
      if (role === "DISTRICT_OFFICER" && districtId) req.query.districtId = districtId;
      if (role === "STATION_OFFICER" && stationId) req.query.stationId = stationId;
      if (role === "DEVICE") return res.status(403).json({ error: "Forbidden" });
      return next();
    }

    if (action === "write") {
      if (role === "PROVINCE_ADMIN") return next();
      if (role === "DISTRICT_OFFICER" && districtId) req.body.district = districtId;
      if (role === "STATION_OFFICER") {
        if (districtId) req.body.district = districtId;
        if (stationId) req.body.policeStation = stationId;
      }
      if (!["PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"].includes(role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return next();
    }
  }

  if (resource === "tukCurrentArea" && action === "read") {
    if (role === "PROVINCE_ADMIN") {
      if (!provinceId) return res.status(403).json({ error: "Forbidden" });
      req.query.provinceId = String(provinceId);
      return next();
    }
    if (role === "DISTRICT_OFFICER") {
      const eff = await getEffectiveDistrictId(req.auth);
      if (!eff) return res.status(403).json({ error: "Forbidden" });
      req.query.districtId = String(eff);
      return next();
    }
    if (role === "STATION_OFFICER") {
      const eff = await getEffectiveDistrictId(req.auth);
      if (!eff || !stationId) return res.status(403).json({ error: "Forbidden" });
      req.query.districtId = String(eff);
      req.geoScope = { restrictToStationId: String(stationId) };
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  }

  if (resource === "locationPing") {
    if (action === "list") {
      if (role === "PROVINCE_ADMIN" && provinceId) req.query.provinceId = provinceId;
      if (role === "DISTRICT_OFFICER" && districtId) req.query.districtId = districtId;
      if (role === "STATION_OFFICER") {
        const eff = await getEffectiveDistrictId(req.auth);
        if (!eff) return res.status(403).json({ error: "Forbidden" });
        req.query.districtId = String(eff);
      }
      if (role === "DEVICE") return res.status(403).json({ error: "Forbidden" });
      return next();
    }

    if (action === "write") {
      if (role === "DEVICE") {
        if (!tukId) return res.status(403).json({ error: "Forbidden" });
        req.body.tuk = tukId;
        req.body.source = "device";
        return next();
      }
      if (["PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER"].includes(role)) return next();
    }
  }

  if (resource === "district" && action === "list") {
    if (role === "PROVINCE_ADMIN" && provinceId) req.query.provinceId = provinceId;
    return next();
  }

  if (resource === "policeStation" && action === "list") {
    if (role === "PROVINCE_ADMIN" && provinceId) req.query.provinceId = provinceId;
    if (role === "DISTRICT_OFFICER" && districtId) req.query.districtId = districtId;
    if (role === "STATION_OFFICER") {
      const eff = await getEffectiveDistrictId(req.auth);
      if (!eff) return res.status(403).json({ error: "Forbidden" });
      req.query.districtId = String(eff);
    }
    return next();
  }

  return res.status(403).json({ error: "Forbidden" });
};
