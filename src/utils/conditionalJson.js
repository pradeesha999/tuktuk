import crypto from "crypto";

// Sends ETag and handles If-None-Match for conditional GETs.
export const sendConditionalJson = (req, res, payload) => {
  const content = JSON.stringify(payload);
  const etag = crypto.createHash("sha1").update(content).digest("hex");
  const requestTag = req.headers["if-none-match"];

  res.set("ETag", etag);
  res.set("Cache-Control", "private, max-age=0, must-revalidate");

  if (requestTag && requestTag === etag) {
    return res.status(304).end();
  }

  return res.json(payload);
};
