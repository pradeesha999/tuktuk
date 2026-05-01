/** Filter for documents that are not soft-deleted ({ deletedAt: null } also matches legacy docs without the field in MongoDB queries). */
export const activeOnly = { deletedAt: null };

export const mergeActive = (filter = {}) => ({ ...filter, ...activeOnly });

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
