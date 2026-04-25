import jwt from "jsonwebtoken";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
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

export const applyScope = (resource, action) => (req, res, next) => {
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

  if (resource === "locationPing") {
    if (action === "list") {
      if (role === "PROVINCE_ADMIN" && provinceId) req.query.provinceId = provinceId;
      if (role === "DISTRICT_OFFICER" && districtId) req.query.districtId = districtId;
      if (role === "STATION_OFFICER" && districtId) req.query.districtId = districtId;
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
    if (role === "STATION_OFFICER" && districtId) req.query.districtId = districtId;
    return next();
  }

  return res.status(403).json({ error: "Forbidden" });
};
