// Omit heavy GeoJSON `boundary` fields from API JSON so list/detail responses stay small
// (Swagger and browsers otherwise stall on multi‑MB payloads after seed:geo-boundaries).

export const EXCLUDE_BOUNDARY = "-boundary";

export const populateProvinceCompact = {
  path: "province",
  match: { deletedAt: null },
  select: EXCLUDE_BOUNDARY
};

export const populateDistrictProvinceCompact = {
  path: "district",
  match: { deletedAt: null },
  select: EXCLUDE_BOUNDARY,
  populate: populateProvinceCompact
};

/** Tuk reads: district + station without polygon payloads */
export const populateTukGeoCompact = [
  {
    path: "district",
    match: { deletedAt: null },
    select: EXCLUDE_BOUNDARY,
    populate: populateProvinceCompact
  },
  {
    path: "policeStation",
    match: { deletedAt: null },
    select: EXCLUDE_BOUNDARY,
    populate: {
      path: "district",
      match: { deletedAt: null },
      select: EXCLUDE_BOUNDARY,
      populate: populateProvinceCompact
    }
  }
];

/** Location ping → tuk → geography without boundaries */
export const pingPopulateCompact = {
  path: "tuk",
  match: { deletedAt: null },
  populate: [
    {
      path: "district",
      match: { deletedAt: null },
      select: EXCLUDE_BOUNDARY,
      populate: populateProvinceCompact
    },
    { path: "policeStation", match: { deletedAt: null }, select: EXCLUDE_BOUNDARY }
  ]
};

export const pingAreaPopulateCompact = [
  {
    path: "resolvedDistrict",
    select: EXCLUDE_BOUNDARY,
    populate: populateProvinceCompact
  },
  { path: "resolvedProvince", match: { deletedAt: null }, select: EXCLUDE_BOUNDARY }
];
