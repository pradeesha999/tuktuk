import crypto from "crypto";
import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import app from "../src/app.js";
import District from "../src/models/District.js";

dotenv.config();

let mongoServer;
let testMongoUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
let authToken = "";

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-for-ci";
}

/** Unique suffix so MongoDB unique indexes never collide on shared Atlas CI databases. */
const mk = () => crypto.randomBytes(4).toString("hex");

const withAuth = (reqBuilder) => reqBuilder.set("Authorization", `Bearer ${authToken}`);

test.before(async () => {
  if (!testMongoUri) {
    mongoServer = await MongoMemoryServer.create();
    testMongoUri = mongoServer.getUri();
  }

  const dbName =
    process.env.TEST_DB_NAME ||
    (process.env.CI === "true"
      ? `webapi_ci_${(process.env.GITHUB_RUN_ID || "local").replace(/[^a-zA-Z0-9_-]/g, "")}_${mk()}`
      : "webapi_test");

  await mongoose.connect(testMongoUri, {
    dbName,
    serverSelectionTimeoutMS: 20_000,
    writeConcern: { w: "majority", journal: true }
  });
});

test.after(async () => {
  try {
    if (process.env.CI === "true" && mongoose.connection?.db) {
      await mongoose.connection.dropDatabase();
    }
  } catch (err) {
    console.warn("test teardown dropDatabase:", err?.message || err);
  }
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(
    collections
      .filter((c) => !c.collectionName.startsWith("system."))
      .map((collection) => collection.deleteMany({}))
  );

  authToken = jwt.sign(
    { username: "ci_hq_admin", role: "HQ_ADMIN" },
    process.env.JWT_SECRET || "change-this-secret",
    { expiresIn: "15m" }
  );
});

test("province -> district -> station linked retrieval", async () => {
  const id = mk();
  const provinceRes = await withAuth(request(app).post("/api/v1/province")).send({
    name: `Western_${id}`,
    code: `WP${id.toUpperCase()}`
  });
  assert.equal(provinceRes.status, 201, JSON.stringify(provinceRes.body));

  const districtRes = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: `Colombo_${id}`, code: `CMB${id.toUpperCase()}`, province: provinceRes.body._id });
  assert.equal(districtRes.status, 201, JSON.stringify(districtRes.body));

  const stationRes = await withAuth(request(app).post("/api/v1/police-station"))
    .send({ name: `Colombo Police Station ${id}`, code: `CMB${id.toUpperCase()}PS`, district: districtRes.body._id });
  assert.equal(stationRes.status, 201, JSON.stringify(stationRes.body));

  const listRes = await withAuth(request(app).get(`/api/v1/police-station?provinceId=${provinceRes.body._id}`));
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.length, 1);
  const first = listRes.body[0];
  assert.ok(first?.district, `missing district on station: ${JSON.stringify(first)}`);
  assert.ok(first.district?.province, `missing province populate: ${JSON.stringify(first.district)}`);
  assert.equal(first.district.province.name, `Western_${id}`);
});

test("create/list tuk with filters", async () => {
  const id = mk();
  const province = await withAuth(request(app).post("/api/v1/province")).send({
    name: `Central_${id}`,
    code: `CP${id.toUpperCase()}`
  });
  assert.equal(province.status, 201, JSON.stringify(province.body));

  const district = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: `Kandy_${id}`, code: `KDY${id.toUpperCase()}`, province: province.body._id });
  assert.equal(district.status, 201, JSON.stringify(district.body));

  const station = await withAuth(request(app).post("/api/v1/police-station"))
    .send({ name: `Kandy Police Station ${id}`, code: `KDY${id.toUpperCase()}PS`, district: district.body._id });
  assert.equal(station.status, 201, JSON.stringify(station.body));

  const tuk = await withAuth(request(app).post("/api/v1/tuk")).send({
    registrationNumber: `WP-1234-${id}`,
    deviceId: `device-0001-${id}`,
    ownerName: "Jane",
    district: district.body._id,
    policeStation: station.body._id
  });
  assert.equal(tuk.status, 201, JSON.stringify(tuk.body));

  const districtFiltered = await withAuth(request(app).get(`/api/v1/tuk?districtId=${district.body._id}`));
  assert.equal(districtFiltered.status, 200);
  assert.equal(districtFiltered.body.length, 1);

  const provinceFiltered = await withAuth(request(app).get(`/api/v1/tuk?provinceId=${province.body._id}`));
  assert.equal(provinceFiltered.status, 200);
  assert.equal(provinceFiltered.body.length, 1);
});

test("create/list pings with time-window filters", async () => {
  const id = mk();
  const province = await withAuth(request(app).post("/api/v1/province")).send({
    name: `Southern_${id}`,
    code: `SP${id.toUpperCase()}`
  });
  assert.equal(province.status, 201, JSON.stringify(province.body));

  const district = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: `Galle_${id}`, code: `GAL${id.toUpperCase()}`, province: province.body._id });
  assert.equal(district.status, 201, JSON.stringify(district.body));

  const tuk = await withAuth(request(app).post("/api/v1/tuk")).send({
    registrationNumber: `SP-1111-${id}`,
    deviceId: `device-1111-${id}`,
    ownerName: "Alex",
    district: district.body._id
  });
  assert.equal(tuk.status, 201, JSON.stringify(tuk.body));

  const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const newTime = new Date().toISOString();

  const deviceTok = jwt.sign(
    { username: `device_${id}`, role: "DEVICE", tukId: tuk.body._id },
    process.env.JWT_SECRET || "change-this-secret",
    { expiresIn: "15m" }
  );

  const ping1 = await request(app)
    .post("/api/v1/location-ping")
    .set("Authorization", `Bearer ${deviceTok}`)
    .send({
      latitude: 6.03,
      longitude: 80.21,
      pingedAt: oldTime
    });
  assert.equal(ping1.status, 201, JSON.stringify(ping1.body));

  const ping2 = await request(app)
    .post("/api/v1/location-ping")
    .set("Authorization", `Bearer ${deviceTok}`)
    .send({
      latitude: 6.04,
      longitude: 80.22,
      pingedAt: newTime
    });
  assert.equal(ping2.status, 201, JSON.stringify(ping2.body));

  const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const list = await withAuth(request(app).get(`/api/v1/location-ping?tukId=${tuk.body._id}&from=${encodeURIComponent(from)}`));
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);

  const tukId = String(tuk.body._id ?? tuk.body.id);
  const allPings = await withAuth(request(app).get(`/api/v1/location-ping?tukId=${tukId}`));
  assert.equal(allPings.status, 200);
  assert.ok(allPings.body.length >= 2, "expected pings to exist before last-location");

  const lastLocation = await withAuth(request(app).get(`/api/v1/tuk/${tukId}/last-location`));
  assert.equal(lastLocation.status, 200);
  assert.equal(typeof lastLocation.body.latitude, "number");
});

test("location pings list filters by provinceId when coords resolve inside boundary", async () => {
  const id = mk();
  const province = await withAuth(request(app).post("/api/v1/province")).send({
    name: `GeoProvince_${id}`,
    code: `GP${id.toUpperCase()}`
  });
  assert.equal(province.status, 201, JSON.stringify(province.body));

  const district = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: `GeoDistrict_${id}`, code: `GD${id.toUpperCase()}`, province: province.body._id });
  assert.equal(district.status, 201, JSON.stringify(district.body));

  const polygon = {
    type: "Polygon",
    coordinates: [
      [
        [80.2, 6.02],
        [80.23, 6.02],
        [80.23, 6.06],
        [80.2, 6.06],
        [80.2, 6.02]
      ]
    ]
  };
  await District.updateOne({ _id: district.body._id }, { $set: { boundary: polygon } });

  const tuk = await withAuth(request(app).post("/api/v1/tuk")).send({
    registrationNumber: `GP-9999-${id}`,
    deviceId: `device-gp-${id}`,
    ownerName: "Geo tester",
    district: district.body._id
  });
  assert.equal(tuk.status, 201, JSON.stringify(tuk.body));

  const deviceTok = jwt.sign(
    { username: `device_gp_${id}`, role: "DEVICE", tukId: tuk.body._id },
    process.env.JWT_SECRET || "change-this-secret",
    { expiresIn: "15m" }
  );

  const ping = await request(app)
    .post("/api/v1/location-ping")
    .set("Authorization", `Bearer ${deviceTok}`)
    .send({
      latitude: 6.035,
      longitude: 80.21,
      pingedAt: new Date().toISOString()
    });
  assert.equal(ping.status, 201, JSON.stringify(ping.body));
  const rp = ping.body.resolvedProvince;
  const resolvedProvinceId = rp && typeof rp === "object" && rp._id ? rp._id : rp;
  assert.equal(String(resolvedProvinceId), String(province.body._id));

  const filtered = await withAuth(
    request(app).get(`/api/v1/location-ping?provinceId=${province.body._id}`)
  );
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.length >= 1, "expected at least one ping for province filter");
  assert.ok(
    filtered.body.some((p) => {
      const v = p.resolvedProvince;
      const id = v && typeof v === "object" && v._id ? v._id : v;
      return String(id) === String(province.body._id);
    }),
    "filtered ping should carry resolvedProvince"
  );
});

test("auth/register: HQ_ADMIN can register station officer and new user can login", async () => {
  const id = mk();
  const province = await withAuth(request(app).post("/api/v1/province")).send({
    name: `Western_${id}`,
    code: `WP${id.toUpperCase()}`
  });
  assert.equal(province.status, 201, JSON.stringify(province.body));

  const district = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: `Colombo_${id}`, code: `CMB${id.toUpperCase()}`, province: province.body._id });
  assert.equal(district.status, 201, JSON.stringify(district.body));

  const station = await withAuth(request(app).post("/api/v1/police-station"))
    .send({ name: `Colombo Police Station ${id}`, code: `CMB${id.toUpperCase()}PS`, district: district.body._id });
  assert.equal(station.status, 201, JSON.stringify(station.body));

  const register = await withAuth(request(app).post("/api/v1/auth/register")).send({
    username: `station.ops.${id}`,
    password: "StrongPass123!",
    role: "STATION_OFFICER",
    stationId: station.body._id
  });

  assert.equal(register.status, 201);
  assert.equal(register.body.username, `station.ops.${id}`);
  assert.equal(register.body.role, "STATION_OFFICER");

  const login = await request(app).post("/api/v1/auth/login").send({
    username: `station.ops.${id}`,
    password: "StrongPass123!"
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "STATION_OFFICER");
  assert.equal(String(login.body.user.stationId), String(station.body._id));
});

test("auth/register: non-HQ user is forbidden", async () => {
  const nonHqToken = jwt.sign(
    { username: "province_admin", role: "PROVINCE_ADMIN", provinceId: "64f0f0f0f0f0f0f0f0f0f0f0" },
    process.env.JWT_SECRET || "change-this-secret",
    { expiresIn: "15m" }
  );

  const register = await request(app)
    .post("/api/v1/auth/register")
    .set("Authorization", `Bearer ${nonHqToken}`)
    .send({
      username: "district.ops",
      password: "StrongPass123!",
      role: "DISTRICT_OFFICER",
      districtId: "64f1f1f1f1f1f1f1f1f1f1f1"
    });

  assert.equal(register.status, 403);
});

test("province list supports ?sort= and exposes X-Total-Count", async () => {
  const id = mk();
  const a = await withAuth(request(app).post("/api/v1/province"))
    .send({ name: `AA_${id}`, code: `AA${id.toUpperCase()}` });
  const b = await withAuth(request(app).post("/api/v1/province"))
    .send({ name: `BB_${id}`, code: `BB${id.toUpperCase()}` });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);

  const asc = await withAuth(request(app).get("/api/v1/province?sort=name"));
  assert.equal(asc.status, 200);
  assert.equal(asc.headers["x-total-count"], "2");
  assert.equal(asc.body[0].name, `AA_${id}`);

  const desc = await withAuth(request(app).get("/api/v1/province?sort=-name"));
  assert.equal(desc.status, 200);
  assert.equal(desc.body[0].name, `BB_${id}`);
});

test("province list returns 304 Not Modified on matching If-None-Match", async () => {
  const id = mk();
  const created = await withAuth(request(app).post("/api/v1/province"))
    .send({ name: `Etag_${id}`, code: `ET${id.toUpperCase()}` });
  assert.equal(created.status, 201);

  const first = await withAuth(request(app).get("/api/v1/province"));
  assert.equal(first.status, 200);
  const etag = first.headers.etag;
  assert.ok(etag, "expected ETag header on the list response");

  const second = await withAuth(
    request(app).get("/api/v1/province").set("If-None-Match", etag)
  );
  assert.equal(second.status, 304);
  assert.equal(second.text, "");
});

test("location-ping list honours ?sort=pingedAt (ascending)", async () => {
  const id = mk();
  const province = await withAuth(request(app).post("/api/v1/province"))
    .send({ name: `Sort_${id}`, code: `SR${id.toUpperCase()}` });
  const district = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: `SortD_${id}`, code: `SD${id.toUpperCase()}`, province: province.body._id });
  const tuk = await withAuth(request(app).post("/api/v1/tuk")).send({
    registrationNumber: `SR-${id}`,
    deviceId: `device-sr-${id}`,
    district: district.body._id
  });

  const deviceTok = jwt.sign(
    { username: `dev_${id}`, role: "DEVICE", tukId: tuk.body._id },
    process.env.JWT_SECRET || "change-this-secret",
    { expiresIn: "15m" }
  );

  const oldTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const newTime = new Date().toISOString();

  const p1 = await request(app)
    .post("/api/v1/location-ping")
    .set("Authorization", `Bearer ${deviceTok}`)
    .send({ latitude: 6.04, longitude: 80.21, pingedAt: newTime });
  const p2 = await request(app)
    .post("/api/v1/location-ping")
    .set("Authorization", `Bearer ${deviceTok}`)
    .send({ latitude: 6.05, longitude: 80.22, pingedAt: oldTime });
  assert.equal(p1.status, 201);
  assert.equal(p2.status, 201);

  const asc = await withAuth(
    request(app).get(`/api/v1/location-ping?tukId=${tuk.body._id}&sort=pingedAt`)
  );
  assert.equal(asc.status, 200);
  assert.equal(asc.headers["x-total-count"], "2");
  assert.ok(
    new Date(asc.body[0].pingedAt) <= new Date(asc.body[1].pingedAt),
    "expected ascending pingedAt order"
  );
});
