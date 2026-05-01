// Helpers for list endpoints: client-controlled sort, pagination, and
// pagination response headers.

// Parse a "?sort=foo,-bar" string into a Mongoose sort object.
// Only fields listed in `allowed` are honoured; unknowns are ignored so a
// caller cannot trigger a scan on a non-indexed field.
export const parseSort = (raw, allowed, fallback) => {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;

  const sort = {};
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const desc = token.startsWith("-");
    const field = desc ? token.slice(1) : token;
    if (allowed.includes(field)) {
      sort[field] = desc ? -1 : 1;
    }
  }

  return Object.keys(sort).length > 0 ? sort : fallback;
};

// Parse `?skip=` and `?limit=` query params with safe defaults.
export const parsePagination = (query, opts = {}) => {
  const defLimit = opts.defaultLimit ?? 100;
  const maxLimit = opts.maxLimit ?? 500;

  const skipNum = Number.parseInt(String(query?.skip ?? ""), 10);
  const limitNum = Number.parseInt(String(query?.limit ?? ""), 10);

  return {
    skip: Number.isFinite(skipNum) && skipNum >= 0 ? skipNum : 0,
    limit:
      Number.isFinite(limitNum) && limitNum >= 1
        ? Math.min(limitNum, maxLimit)
        : defLimit
  };
};

// Set X-Total-Count plus rel="next"/"prev" Link headers on a list response.
export const setPaginationHeaders = (req, res, { total, skip, limit }) => {
  res.set("X-Total-Count", String(total));

  const path = req.originalUrl.split("?")[0];
  const others = { ...req.query };
  delete others.skip;
  delete others.limit;

  const buildUrl = (s, l) => {
    const params = new URLSearchParams({
      ...others,
      skip: String(s),
      limit: String(l)
    });
    return `${path}?${params.toString()}`;
  };

  const links = [];
  if (skip + limit < total) {
    links.push(`<${buildUrl(skip + limit, limit)}>; rel="next"`);
  }
  if (skip > 0) {
    links.push(`<${buildUrl(Math.max(0, skip - limit), limit)}>; rel="prev"`);
  }
  if (links.length > 0) {
    res.set("Link", links.join(", "));
  }
};
