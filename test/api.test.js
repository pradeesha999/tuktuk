import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import app from "../src/app.js";

dotenv.config();

let mongoServer;
let testMongoUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
let authToken = "";

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-for-ci";
}

const withAuth = (reqBuilder) => reqBuilder.set("Authorization", `Bearer ${authToken}`);

test.before(async () => {
  if (!testMongoUri) {
    mongoServer = await MongoMemoryServer.create();
    testMongoUri = mongoServer.getUri();
  }

  const useIsolatedDb = process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true";
  const shortId = crypto.randomBytes(6).toString("hex");
  const dbName = useIsolatedDb ? `webapi_${shortId}` : "webapi_test";

  await mongoose.connect(testMongoUri, { dbName });
});

test.after(async () => {
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));

  authToken = jwt.sign(
    { username: "ci_hq_admin", role: "HQ_ADMIN" },
    process.env.JWT_SECRET || "change-this-secret",
    { expiresIn: "15m" }
  );
});

test("province -> district -> station linked retrieval", async () => {
  const provinceRes = await withAuth(request(app).post("/api/v1/province")).send({ name: "Western", code: "WP" });
  assert.equal(provinceRes.status, 201);

  const districtRes = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: "Colombo", code: "CMB", province: provinceRes.body._id });
  assert.equal(districtRes.status, 201);

  const stationRes = await withAuth(request(app).post("/api/v1/police-station"))
    .send({ name: "Colombo Police Station", code: "CMB-PS", district: districtRes.body._id });
  assert.equal(stationRes.status, 201);

  const listRes = await withAuth(request(app).get(`/api/v1/police-station?provinceId=${provinceRes.body._id}`));
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.length, 1);
  const first = listRes.body[0];
  assert.ok(first?.district, `missing district on station: ${JSON.stringify(first)}`);
  assert.ok(first.district?.province, `missing province populate: ${JSON.stringify(first.district)}`);
  assert.equal(first.district.province.name, "Western");
});

test("create/list tuk with filters", async () => {
  const province = await withAuth(request(app).post("/api/v1/province")).send({ name: "Central", code: "CP" });
  const district = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: "Kandy", code: "KDY", province: province.body._id });

  const station = await withAuth(request(app).post("/api/v1/police-station"))
    .send({ name: "Kandy Police Station", code: "KDY-PS", district: district.body._id });

  const tuk = await withAuth(request(app).post("/api/v1/tuk")).send({
    registrationNumber: "WP-1234",
    deviceId: "device-0001",
    ownerName: "Jane",
    district: district.body._id,
    policeStation: station.body._id
  });
  assert.equal(tuk.status, 201);

  const districtFiltered = await withAuth(request(app).get(`/api/v1/tuk?districtId=${district.body._id}`));
  assert.equal(districtFiltered.status, 200);
  assert.equal(districtFiltered.body.length, 1);

  const provinceFiltered = await withAuth(request(app).get(`/api/v1/tuk?provinceId=${province.body._id}`));
  assert.equal(provinceFiltered.status, 200);
  assert.equal(provinceFiltered.body.length, 1);
});

test("create/list pings with time-window filters", async () => {
  const province = await withAuth(request(app).post("/api/v1/province")).send({ name: "Southern", code: "SP" });
  const district = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: "Galle", code: "GAL", province: province.body._id });
  const tuk = await withAuth(request(app).post("/api/v1/tuk")).send({
    registrationNumber: "SP-1111",
    deviceId: "device-1111",
    ownerName: "Alex",
    district: district.body._id
  });

  const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const newTime = new Date().toISOString();

  const ping1 = await withAuth(request(app).post("/api/v1/location-ping")).send({
    tuk: tuk.body._id,
    latitude: 6.03,
    longitude: 80.21,
    pingedAt: oldTime
  });
  assert.equal(ping1.status, 201);

  const ping2 = await withAuth(request(app).post("/api/v1/location-ping")).send({
    tuk: tuk.body._id,
    latitude: 6.04,
    longitude: 80.22,
    pingedAt: newTime
  });
  assert.equal(ping2.status, 201);

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

test("auth/register: HQ_ADMIN can register station officer and new user can login", async () => {
  const province = await withAuth(request(app).post("/api/v1/province")).send({ name: "Western", code: "WP" });
  assert.equal(province.status, 201);
  const district = await withAuth(request(app).post("/api/v1/district"))
    .send({ name: "Colombo", code: "CMB", province: province.body._id });
  assert.equal(district.status, 201);
  const station = await withAuth(request(app).post("/api/v1/police-station"))
    .send({ name: "Colombo Police Station", code: "CMB-PS", district: district.body._id });
  assert.equal(station.status, 201);

  const register = await withAuth(request(app).post("/api/v1/auth/register")).send({
    username: "station.ops",
    password: "StrongPass123!",
    role: "STATION_OFFICER",
    stationId: station.body._id
  });

  assert.equal(register.status, 201);
  assert.equal(register.body.username, "station.ops");
  assert.equal(register.body.role, "STATION_OFFICER");

  const login = await request(app).post("/api/v1/auth/login").send({
    username: "station.ops",
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
