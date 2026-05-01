// Resolve Sri Lanka administrative area from a lon/lat using stored GeoJSON boundaries.
import District from "../models/District.js";
import Province from "../models/Province.js";
import { mergeActive } from "./softDelete.js";

export const resolveAdministrativeArea = async (longitude, latitude) => {
  const point = {
    type: "Point",
    coordinates: [longitude, latitude]
  };

  const district = await District.findOne(
    mergeActive({
      boundary: { $geoIntersects: { $geometry: point } }
    })
  )
    .select("_id province")
    .lean();

  if (district) {
    return {
      point,
      resolvedDistrict: district._id,
      resolvedProvince: district.province
    };
  }

  const province = await Province.findOne(
    mergeActive({
      boundary: { $geoIntersects: { $geometry: point } }
    })
  )
    .select("_id")
    .lean();

  return {
    point,
    resolvedDistrict: null,
    resolvedProvince: province?._id || null
  };
};
