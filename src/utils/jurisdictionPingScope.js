import mongoose from "mongoose";
import District from "../models/District.js";
import Tuk from "../models/Tuk.js";
import { getEffectiveDistrictId } from "../middleware/authMiddleware.js";
import { mergeActive } from "./softDelete.js";

/** ObjectIds of tuks “owned” by this officer’s registration jurisdiction (full visibility). */
export const getHomeTukIds = async (auth) => {
  if (!auth || auth.role === "HQ_ADMIN") return null;

  if (auth.role === "DISTRICT_OFFICER" && auth.districtId) {
    return Tuk.find(mergeActive({ district: auth.districtId })).distinct("_id");
  }
  if (auth.role === "PROVINCE_ADMIN" && auth.provinceId) {
    const dIds = await District.find(mergeActive({ province: auth.provinceId })).distinct("_id");
    if (!dIds.length) return [];
    return Tuk.find(mergeActive({ district: { $in: dIds } })).distinct("_id");
  }
  if (auth.role === "STATION_OFFICER" && auth.stationId) {
    return Tuk.find(mergeActive({ policeStation: auth.stationId })).distinct("_id");
  }
  return [];
};

export const homeTukIdStrings = async (auth) => {
  const ids = await getHomeTukIds(auth);
  if (ids === null) return null;
  return new Set(ids.map((id) => String(id)));
};

export const isHomeTukDoc = (tukDoc, auth) => {
  if (!auth || auth.role === "HQ_ADMIN") return true;
  const tid = String(tukDoc?.district?._id || tukDoc?.district || "");
  const pid = String(tukDoc?.district?.province?._id || tukDoc?.district?.province || "");
  const sid = String(tukDoc?.policeStation?._id || tukDoc?.policeStation || "");

  if (auth.role === "DISTRICT_OFFICER") return tid === String(auth.districtId);
  if (auth.role === "PROVINCE_ADMIN") return pid === String(auth.provinceId);
  if (auth.role === "STATION_OFFICER") return sid === String(auth.stationId);
  return false;
};

/**
 * Pings visible to this officer:
 * – Home-jurisdiction tuks: all pings everywhere.
 * – Other tuks: only pings whose resolved area falls inside this officer’s district/province.
 */
export const buildPingVisibilityClause = async (auth) => {
  const homeIds = await getHomeTukIds(auth);
  if (homeIds === null) return null;

  const hid = homeIds.map((id) => new mongoose.Types.ObjectId(id));

  if (auth.role === "DISTRICT_OFFICER" && auth.districtId) {
    const dOid = new mongoose.Types.ObjectId(auth.districtId);
    return {
      $or: [{ tuk: { $in: hid } }, { $and: [{ resolvedDistrict: dOid }, { tuk: { $nin: hid } }] }]
    };
  }

  if (auth.role === "PROVINCE_ADMIN" && auth.provinceId) {
    const pOid = new mongoose.Types.ObjectId(auth.provinceId);
    return {
      $or: [{ tuk: { $in: hid } }, { $and: [{ resolvedProvince: pOid }, { tuk: { $nin: hid } }] }]
    };
  }

  if (auth.role === "STATION_OFFICER") {
    const eff = await getEffectiveDistrictId(auth);
    if (!eff) {
      return { tuk: { $in: hid } };
    }
    const dOid = new mongoose.Types.ObjectId(eff);
    return {
      $or: [{ tuk: { $in: hid } }, { $and: [{ resolvedDistrict: dOid }, { tuk: { $nin: hid } }] }]
    };
  }

  return { tuk: { $in: hid } };
};

/** Strip populated tuk on a ping for foreign-jurisdiction viewers (plate only). */
export const sanitizePingForViewer = (pingPlain, auth, homeSet) => {
  if (!auth || auth.role === "HQ_ADMIN" || !pingPlain?.tuk) return pingPlain;

  const tid = String(pingPlain.tuk._id || pingPlain.tuk);
  if (homeSet && homeSet.has(tid)) return pingPlain;

  const reg = pingPlain.tuk.registrationNumber;
  return {
    ...pingPlain,
    tuk: {
      _id: pingPlain.tuk._id,
      registrationNumber: reg
    }
  };
};
