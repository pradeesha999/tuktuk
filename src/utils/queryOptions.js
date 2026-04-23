// Query helpers for pagination and sorting on list endpoints.
export const parsePagination = (query) => {
  const page = Number.parseInt(query.page, 10) || 1;
  const limit = Number.parseInt(query.limit, 10) || 20;
  const safePage = page > 0 ? page : 1;
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, skip };
};

export const parseSort = (query, allowedFields, fallbackField = "createdAt") => {
  const sortField = allowedFields.includes(query.sort) ? query.sort : fallbackField;
  const order = query.order === "asc" ? 1 : -1;
  return { [sortField]: order };
};
