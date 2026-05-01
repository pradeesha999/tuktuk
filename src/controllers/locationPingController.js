// Location ping controller: ingest and query historical movement logs.
import LocationPing from "../models/LocationPing.js";
import Tuk from "../models/Tuk.js";
import { resolveAdministrativeArea } from "../utils/resolveAdministrativeArea.js";
import {
  buildPingVisibilityClause,
  homeTukIdStrings,
  sanitizePingForViewer
} from "../utils/jurisdictionPingScope.js";
import { mergeActive } from "../utils/softDelete.js";

import {
  pingAreaPopulateCompact,
  pingPopulateCompact
} from "../utils/geoResponse.js";
import {
  parsePagination,
  parseSort,
  setPaginationHeaders
} from "../utils/queryOptions.js";

const PING_SORT_FIELDS = ["pingedAt", "speedKmh", "createdAt"];
const PING_PAGINATION_OPTS = { defaultLimit: 100, maxLimit: 500 };

// Create one location ping record (DEVICE tokens only at route layer).
export const createLocationPing = async (req, res) => {
  try {
    const tukAlive = await Tuk.findOne(mergeActive({ _id: req.body.tuk }));
    if (!tukAlive) return res.status(404).json({ error: "Tuk not found or inactive" });

    const area = await resolveAdministrativeArea(req.body.longitude, req.body.latitude);
    const ping = await LocationPing.create({
      ...req.body,
      point: area.point,
      resolvedDistrict: area.resolvedDistrict,
      resolvedProvince: area.resolvedProvince
    });
    const populated = await LocationPing.findById(ping._id).populate([
      pingPopulateCompact,
      ...pingAreaPopulateCompact
    ]);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get movement logs with tuk and geography filters (active tuks only).
export const getLocationPings = async (req, res) => {
  try {
    const auth = req.auth;
    const { tukId, districtId, provinceId, from, to } = req.query;

    const sort = parseSort(req.query.sort, PING_SORT_FIELDS, { pingedAt: -1 });
    const { skip, limit } = parsePagination(req.query, PING_PAGINATION_OPTS);

    const andParts = [];

    if (from || to) {
      const range = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      andParts.push({ pingedAt: range });
    }

    if (auth.role === "DEVICE") {
      if (!auth.tukId) return res.status(403).json({ error: "Forbidden" });
      andParts.push({ tuk: auth.tukId });
      const filter = andParts.length === 1 ? andParts[0] : { $and: andParts };

      const [pings, total] = await Promise.all([
        LocationPing.find(filter)
          .populate([pingPopulateCompact, ...pingAreaPopulateCompact])
          .sort(sort)
          .skip(skip)
          .limit(limit),
        LocationPing.countDocuments(filter)
      ]);

      setPaginationHeaders(req, res, { total, skip, limit });
      return res.json(pings);
    }

    const activeTuks = await Tuk.find(mergeActive()).select("_id").lean();
    const activeIds = activeTuks.map((t) => t._id);
    if (activeIds.length === 0) {
      setPaginationHeaders(req, res, { total: 0, skip, limit });
      return res.json([]);
    }

    andParts.push({ tuk: { $in: activeIds } });

    if (auth.role === "HQ_ADMIN") {
      if (districtId) andParts.push({ resolvedDistrict: districtId });
      if (provinceId) andParts.push({ resolvedProvince: provinceId });
    }

    if (tukId) {
      andParts.push({ tuk: tukId });
    }

    const vis = await buildPingVisibilityClause(auth);
    if (vis) {
      andParts.push(vis);
    }

    const filter = andParts.length === 1 ? andParts[0] : { $and: andParts };

    const [pings, total] = await Promise.all([
      LocationPing.find(filter)
        .populate([pingPopulateCompact, ...pingAreaPopulateCompact])
        .sort(sort)
        .skip(skip)
        .limit(limit),
      LocationPing.countDocuments(filter)
    ]);

    const homeSet = await homeTukIdStrings(auth);
    const out = pings.map((doc) => {
      const plain = doc.toObject ? doc.toObject() : doc;
      return sanitizePingForViewer(plain, auth, homeSet);
    });

    setPaginationHeaders(req, res, { total, skip, limit });
    return res.json(out);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
