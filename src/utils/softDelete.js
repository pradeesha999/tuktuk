/** Soft-delete filter: include docs with no `deletedAt` field or `deletedAt: null` (explicit $or for driver/server consistency). */
const activeClause = {
  $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
};

/** @deprecated Prefer mergeActive(); kept for callers that need the raw clause */
export const activeOnly = activeClause;

/** AND-safe composition so filters with `$or` / `$and` are not broken by spreading. */
export const mergeActive = (filter = {}) => {
  const f = { ...filter };
  if (Object.keys(f).length === 0) return { ...activeClause };
  return { $and: [f, activeClause] };
};

/** Use after $lookup + $unwind on `tuks` collection */
export const activeTukDocMatch = {
  $or: [{ "tuk.deletedAt": null }, { "tuk.deletedAt": { $exists: false } }]
};

/** Drop `deletedAt` from a request body so callers cannot un-delete via update. */
export const stripDeletedAt = (body) => {
  const copy = { ...body };
  delete copy.deletedAt;
  return copy;
};
