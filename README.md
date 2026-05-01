# Tuk-Tuk Tracking API

**Student ID:** COBSCCOMP242P-052  
**Module:** NB6007CEM — Web API Development (Coventry / NIBM)  
**Author:** Pradeesha Hettiarachchi  

This repository is the **RESTful Web API** for the coursework business case: a **centralised tuk-tuk (three-wheeler) tracking and movement logging** system for **Sri Lanka law enforcement**—vehicle registration, administrative geography (provinces / districts / stations), **GPS location pings**, **last-known location**, **historical movement** with time and geography filters, and **role-based access** (HQ, province, district, station, and device clients). There is **no mobile app or web UI** in scope; use **Swagger UI**, **Postman**, or **curl** (see [`docs/API_TEST_AND_CURL_GUIDE.md`](docs/API_TEST_AND_CURL_GUIDE.md)).

---

## Alignment with the coursework brief

| Coursework expectation | How this project addresses it |
|------------------------|----------------------------------|
| RESTful API, Node.js / ES6+ | Express 5, ES modules, JSON over HTTP |
| HQ / provincial / district / station users | JWT roles: `HQ_ADMIN`, `PROVINCE_ADMIN`, `DISTRICT_OFFICER`, `STATION_OFFICER` |
| Tuk operators / devices | Role `DEVICE`; **only devices** may `POST` location pings (JWT must include `tukId`) |
| Provinces & districts (Sri Lanka) | **9 provinces**, **25 districts** via `npm run seed:master`; GeoJSON **boundaries** via `npm run seed:geo-boundaries` |
| 20+ police stations | **25** stations (one per district) in the same seed |
| 200+ registered tuks | `npm run simulate:tracking` upserts **200** tuks |
| Periodic pings, ≥1 week history, realistic patterns | **3-hour** interval over **7 days**; in-polygon sampling + short-path movement inside home district; `source: "simulated"` |
| Simulation / demo data | Data is **written to MongoDB** by scripts (suitable for demo and report; export to JSON/CSV separately if the brief requires a file artefact) |
| API specification (Swagger) | **OpenAPI 3** via `swagger-jsdoc`; UI at **`/api-docs`** |
| Deployed API (viva: not localhost-only) | Deploy as you document in the report; see [`docs/AWS_AND_CI_CD.md`](docs/AWS_AND_CI_CD.md) and [`.github/workflows`](.github/workflows) |

**Report & submission:** Write the **≈3000-word report** separately (LMS). Include **Student ID** here (above), **GitHub URL**, **deployed API URL**, **Swagger URL**, and add the **assessor as GitHub collaborator** as required by the brief. Optional local notes: [`docs/REPORT.md`](docs/REPORT.md), [`docs/MANUAL_E2E_FLOW.md`](docs/MANUAL_E2E_FLOW.md).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js (ES modules, `"type": "module"`) |
| HTTP | Express 5 |
| Data | MongoDB + Mongoose 9 |
| Auth | JWT (`jsonwebtoken`), bcrypt password hashing |
| Validation | `express-validator` |
| Security / ops | `helmet`, `cors`, `express-rate-limit` (global + stricter auth route limiter) |
| API docs | `swagger-jsdoc` + `swagger-ui-express` → `/api-docs` |

---

## Repository layout

```
server.js                 # Entry: validate env, connect DB, listen
src/
  app.js                  # Express app, middleware, route mounting
  config/
    db.js                 # Mongoose connect; `getAppDatabaseName()` (default `webapi_prod`)
    env.js                # Required env validation (`MONGO_URI`, `JWT_SECRET`)
    swagger.js            # OpenAPI base + bearer security
    authUsers.js          # Optional dev fallback users (override with `AUTH_USERS` JSON)
  controllers/            # Province, district, police station, tuk, location ping, auth
  middleware/             # JWT auth, RBAC, `bindDeviceTukForPing`, validation
  models/                 # Province, District, PoliceStation, Tuk, LocationPing, User
  routes/                 # REST routes + Swagger JSDoc annotations
  utils/
    softDelete.js         # `mergeActive`, `activeTukDocMatch` (soft delete)
    resolveAdministrativeArea.js  # GeoJSON `$geoIntersects` → resolved district/province
    geoResponse.js        # Populate shapes that omit huge `boundary` fields in JSON
    jurisdictionPingScope.js      # Home vs transit ping visibility + plate-only sanitise
  validators/             # Auth + resource express-validator chains
scripts/
  seedMasterData.js       # Provinces, districts, stations
  seedGeoBoundaries.js    # OSM/Nominatim polygons → `boundary` on Province/District
  simulateTrackingData.js # 200 tuks + ~1 week pings (requires boundaries)
  seedPoliceStations.js   # Auxiliary / legacy station seeding if used
  migrateTestDbToWebapiProd.js
  cleanupTestDbs.js
  stressTest.js
test/
  api.test.js             # Supertest integration tests (memory or `TEST_MONGO_URI`)
docs/                     # Runbooks, curl guide, E2E checklist, report notes
.github/workflows/      # CI (e.g. lint/test on push)
courseowork.md            # Module brief (local reference)
```

---

## Environment variables

**Required**

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection string (Atlas or local) |
| `JWT_SECRET` | Secret for signing JWTs |

**Common optional**

| Variable | Default / notes |
|----------|-----------------|
| `PORT` | `5000` |
| `MONGO_DB_NAME` | `webapi_prod` — database name used by the app and seed/simulate scripts (can differ from path in URI) |
| `JWT_EXPIRES_IN` | `12h` |
| `CORS_ORIGIN` | `*` |
| `SWAGGER_SERVER_URL` | `/api/v1` — OpenAPI server URL for “Try it out” |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Global API rate limit |
| `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX` | `/api/v1/auth/*` limiter |
| `LAST_PING_AREA_MAX_AGE_MINUTES` | Fallback: `CURRENT_AREA_MAX_AGE_MINUTES`, then `60` — stale cutoff for `GET /tuk/last-ping-area` |
| `AUTH_USERS` | JSON array of `{ username, password, role, provinceId?, districtId?, stationId?, tukId? }` to override [`src/config/authUsers.js`](src/config/authUsers.js) dev users |

**Tests** (`npm test`): use `TEST_MONGO_URI` (optional) and `TEST_DB_NAME` (default `webapi_test`); tests clear non-system collections between cases.

Example `.env`:

```env
PORT=5000
MONGO_URI=mongodb+srv://USER:PASS@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=webapi_prod
JWT_SECRET=use_a_long_random_string
JWT_EXPIRES_IN=12h
```

URL-encode special characters in passwords inside `MONGO_URI`. In Atlas, configure **Network Access** for your IP (or VPC) and ensure the DB user can read/write the target database.

---

## Install and run

```bash
npm install
npm run dev          # nodemon — development
npm start            # production (node server.js)
npm run lint         # ESLint
npm run lint:ci      # ESLint, zero warnings (CI)
npm test             # Node test runner + supertest (concurrency 1)
npm run stress:test  # Optional local stress script
```

- **Health:** server listens on `PORT` (default **5000**), host `0.0.0.0`.  
- **API base path:** `/api/v1`  
- **Swagger UI:** `http://localhost:<PORT>/api-docs` (or your deployed origin + `/api-docs`). Click **Authorize** and send `Bearer <token>`.

---

## Demo data pipeline (coursework-scale simulation)

Run **in order** against the same database the API uses (`MONGO_DB_NAME`, default `webapi_prod`):

```bash
npm run seed:master          # 9 provinces, 25 districts, 25 police stations
npm run seed:geo-boundaries  # Fetches GeoJSON from Nominatim (network; ~1 req/s). Populates Province/District.boundary
npm run simulate:tracking    # Deletes prior simulated pings, upserts 200 tuks, inserts ~1 week of pings
```

- **Geo seed** needs outbound HTTPS. If a boundary is missing, check script logs and Nominatim usage policy (script sends a descriptive `User-Agent`).  
- **Simulation** keeps pings inside each tuk’s **home district** polygon (in-memory point-in-polygon + Mongo resolution for stored fields), sets `point`, `resolvedDistrict`, `resolvedProvince`, and uses **compact** responses elsewhere so list endpoints do not return multi‑MB GeoJSON.

Other maintenance scripts (see `package.json`): `npm run migrate:test-to-prod`, `npm run cleanup:test-dbs`.

---

## Authentication and roles

| Role | Typical JWT claims | Capabilities (summary) |
|------|--------------------|---------------------------|
| `HQ_ADMIN` | — | Full CRUD on geography and tuks; all pings; optional filters on lists |
| `PROVINCE_ADMIN` | `provinceId` | Scoped lists; full ping trail for **tuks registered in that province**; **transit-only** pings (resolved in province) for other tuks; minimal tuk info for out-of-scope tuks |
| `DISTRICT_OFFICER` | `districtId` | Scoped lists; full trail for **tuks registered in that district**; **transit-only** pings when `resolvedDistrict` is that district; plate-only embedded `tuk` on those rows |
| `STATION_OFFICER` | `stationId` (+ effective district from station) | Same pattern as district, anchored to the station’s district |
| `DEVICE` | **`tukId` (required for pings)** | **`POST /location-ping` only** (plus **`GET /location-ping`** for that tuk); blocked from other resources |

**Login:** `POST /api/v1/auth/login` with `{ "username", "password" }` → `{ token, user }`.  
**Register:** `POST /api/v1/auth/register` — **`HQ_ADMIN` only** — creates a DB user with hashed password and scope fields.

Default **development** users (plain passwords) are in [`src/config/authUsers.js`](src/config/authUsers.js) unless overridden by `AUTH_USERS`. **Production:** use DB users only; for **`DEVICE`**, ensure the user (or JSON entry) includes **`tukId`** matching a real tuk, otherwise ping ingestion returns 403.

---

## REST API surface (v1)

All routes below are under **`/api/v1`** and (except login) require:

```http
Authorization: Bearer <JWT>
```

| Resource | Path prefix | Notes |
|----------|-------------|--------|
| Auth | `/auth` | `POST /login` (no JWT); `POST /register` (HQ only) |
| Province | `/province` | List responses omit large `boundary` by default; `GET /province/:id?includeBoundary=true` to include |
| District | `/district` | Same `includeBoundary` pattern on `GET /district/:id` |
| Police station | `/police-station` | Optional `?provinceId=` / `?districtId=` |
| Tuk | `/tuk` | `GET /tuk/:id/last-location`; `GET /tuk/last-ping-area` (alias `GET /tuk/current-area`); geography query params on lists where RBAC allows |
| Location ping | `/location-ping` | **`POST` = `DEVICE` only**; **`GET`** supports `limit` (default 100, max 500), `skip`, time range, optional `tukId` / HQ-only resolved filters |

**Jurisdiction rules for pings (officers):**  
- **Home tuks** (registered in your province/district/station): **all** pings worldwide.  
- **Other tuks**: only pings whose **resolved** district/province is **inside** your jurisdiction; JSON shows **`tuk` as `{ _id, registrationNumber }`** only for those.

**Geo resolution:** Each ping stores `latitude`, `longitude`, GeoJSON `point`, and `resolvedDistrict` / `resolvedProvince` from boundaries seeded by `seed:geo-boundaries`.

Full method-level detail: **Swagger** at `/api-docs` and [`docs/API_ENDPOINTS_FULL.md`](docs/API_ENDPOINTS_FULL.md).

---

## Coursework “simulation data” note

The brief asks for generated data in **JSON or CSV**. This project generates **MongoDB documents** via scripts (realistic scale for the API). For submission artefacts, **export** collections (e.g. Compass, `mongoexport`) or note in the report that the **canonical** demo dataset lives in the deployed database and is reproducible with the npm scripts above.

---

## Testing and quality

- **`npm test`** — integration tests against `mongodb-memory-server` or `TEST_MONGO_URI`.  
- **`npm run lint:ci`** — must pass with **zero warnings** (matches rubric expectations for clean code).

---

## Documentation in `docs/`

| File | Purpose |
|------|---------|
| [`API_TEST_AND_CURL_GUIDE.md`](docs/API_TEST_AND_CURL_GUIDE.md) | curl / Postman examples |
| [`API_ENDPOINTS_FULL.md`](docs/API_ENDPOINTS_FULL.md) | Endpoint reference |
| [`MANUAL_E2E_FLOW.md`](docs/MANUAL_E2E_FLOW.md) | Manual E2E checklist |
| [`AWS_AND_CI_CD.md`](docs/AWS_AND_CI_CD.md) | Deployment / CI |
| [`GITHUB_SECRETS_CHECKLIST.md`](docs/GITHUB_SECRETS_CHECKLIST.md) | GitHub Actions secrets |
| [`SECURITY_IMPLEMENTATION_PLAN.md`](docs/SECURITY_IMPLEMENTATION_PLAN.md) | Security notes |
| [`P1_TRANSPORT_AND_SECRETS_RUNBOOK.md`](docs/P1_TRANSPORT_AND_SECRETS_RUNBOOK.md) | Transport/secrets runbook |
| [`REPORT.md`](docs/REPORT.md) | Report workspace / notes |

---

## GitHub & license

- **Repository:** [github.com/pradeesha999/tuktuk](https://github.com/pradeesha999/tuktuk)  
- **License:** ISC  

---

**Reminder:** Add your **module assessor** as a **collaborator** on the GitHub repository before the deadline, and keep the **deployed API** and **Swagger** URLs current in your report appendix.
