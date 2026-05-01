# Tuk-Tuk Tracking API

**Student ID:** COBSCCOMP242P-052
**Module:** NB6007CEM – Web API Development
**Author:** Pradeesha Hettiarachchi

REST API for the NB6007CEM coursework. Manages provinces, districts, police stations, registered tuk-tuks, location pings, and users for the Sri Lanka Police tuk-tuk tracking system.

## Tech Stack

- Node.js (ES Modules)
- Express
- MongoDB Atlas + Mongoose
- JWT auth (with bcrypt password hashing)
- Helmet, CORS, express-rate-limit
- Swagger UI (`/api-docs`)

## Project Setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```env
PORT=5000
MONGO_URI=mongodb+srv://USER:PASS@CLUSTER.mongodb.net/?retryWrites=true&w=majority
# Optional. API + seed/simulate scripts use this database name (default: webapi_prod).
# Overrides any database name in the MONGO_URI path.
# MONGO_DB_NAME=webapi_prod
JWT_SECRET=long_random_string
JWT_EXPIRES_IN=12h
```

Notes:
- If your DB password contains `@` or other special chars, URL-encode them in `MONGO_URI`.
- In MongoDB Atlas, add your current IP under Network Access.
- **Application database.** The server and `npm run seed:*` / `npm run simulate:*` connect with database name **`webapi_prod`** by default (`MONGO_DB_NAME`), even if `MONGO_URI` still ends with `/test`. Point `MONGO_URI` at `…/webapi_prod?…` as well if you want the URI and actual DB name to match in Atlas.
- **Tests** always use database **`webapi_test`** (see `test/api.test.js`, env `TEST_DB_NAME`). They do not read `MONGO_DB_NAME`.

### Copy existing data from `test` to `webapi_prod`

MongoDB cannot rename a database in place. To keep every document exactly as stored (BSON types such as `Date` and `ObjectId` are unchanged), use the migration script:

1. **Stop the API** (Ctrl+C locally, or `pm2 stop …` on EC2) so nothing writes during the copy.
2. Keep `MONGO_URI` in `.env` pointed at the same Atlas cluster (the database name in the URI does not matter; the script uses explicit names).
3. Run:

```bash
npm run migrate:test-to-prod
```

By default this copies database **`test`** → **`webapi_prod`**. The target database must be empty on first run. To wipe `webapi_prod` and copy again:

```bash
npm run migrate:test-to-prod -- --replace-target
```

Optional: after you have pointed the app at `webapi_prod` and verified it, remove the old database (you will be asked to type `test` to confirm):

```bash
npm run migrate:test-to-prod -- --drop-source-only
```

(This skips copying and only drops the source DB.)

Or in a single run after copy:

```bash
npm run migrate:test-to-prod -- --drop-source
```

Overrides: `MIGRATE_SOURCE_DB`, `MIGRATE_TARGET_DB`, `MIGRATE_BATCH_SIZE`.

4. Change `MONGO_URI` to use `/webapi_prod` in the path, then start the API again.

## Run

```bash
npm run dev              # nodemon (development)
npm start                # production
npm test                 # integration tests
npm run lint             # eslint
npm run stress:test      # local DDoS / brute-force stress test
npm run cleanup:test-dbs # interactively drop leftover webapi_* databases in Atlas
```

## Seed and Simulate Demo Data

```bash
npm run seed:master         # 9 provinces, 25 districts, 25 police stations
npm run seed:geo-boundaries # GeoJSON polygons for provinces and districts (Nominatim)
npm run simulate:tracking   # 200 tuks + ~1 week of location pings
```

Server runs at `http://localhost:5000` by default.

## Authentication

All endpoints except `POST /auth/login` require a JWT.

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "username": "hqadmin", "password": "hqadmin123" }
```

Response includes `token`. Send it as `Authorization: Bearer <token>` on every other request.

### Register (HQ admin only)

```http
POST /api/v1/auth/register
Authorization: Bearer <HQ_ADMIN_TOKEN>
Content-Type: application/json

{
  "username": "station.officer1",
  "password": "StrongPass123!",
  "role": "STATION_OFFICER",
  "stationId": "<station_object_id>"
}
```

Allowed roles when registering: `PROVINCE_ADMIN`, `DISTRICT_OFFICER`, `STATION_OFFICER`, `DEVICE`. Each role requires its own scope id (`provinceId` / `districtId` / `stationId` / `tukId`).

### Default seed users (development only)

| Username | Password | Role |
|---|---|---|
| `hqadmin` | `hqadmin123` | HQ_ADMIN |
| `province_user` | `province123` | PROVINCE_ADMIN |
| `district_user` | `district123` | DISTRICT_OFFICER |
| `station_user` | `station123` | STATION_OFFICER |
| `device_user` | `device123` | DEVICE |

## Endpoints

Base URL: `http://localhost:5000/api/v1` (or the deployed URL).

Full request bodies and parameters are in Swagger: `http://localhost:5000/api-docs`.

### Province (HQ_ADMIN for write; all roles for read)
- `POST /province`
- `GET /province`
- `GET /province/:id`
- `PUT /province/:id`
- `DELETE /province/:id`

### District
- `POST /district` (HQ)
- `GET /district` (optional `?provinceId=`)
- `GET /district/:id`
- `PUT /district/:id` (HQ)
- `DELETE /district/:id` (HQ)

### Police Station
- `POST /police-station` (HQ)
- `GET /police-station` (optional `?provinceId=` or `?districtId=`)
- `GET /police-station/:id`
- `PUT /police-station/:id` (HQ)
- `DELETE /police-station/:id` (HQ)

### Tuk
- `POST /tuk`
- `GET /tuk` (optional `?provinceId=`, `?districtId=`, `?stationId=`)
- `GET /tuk/:id`
- `GET /tuk/:id/last-location`
- `GET /tuk/last-ping-area` (each tuk's **last ping** within max age, with resolved district/province; optional `?provinceId=` / `?districtId=` / `maxAgeMinutes=`; legacy alias `GET /tuk/current-area`)
- `PUT /tuk/:id`
- `DELETE /tuk/:id`

### Location Ping
- `POST /location-ping` (**DEVICE** JWT must include `tukId`; admins do not post pings through this endpoint)
- `GET /location-ping` (officers + DEVICE; **limit/skip** pagination; officers see **all pings for home-jurisdiction tuks**, and **only in-area pings** for foreign tuks — plate-only `tuk` payload for those)

`provinceId` and `districtId` filters use the **resolved area** computed from each ping's coordinates against the GeoJSON boundaries seeded by `seed:geo-boundaries`.

## Quick Verification

```bash
npm run seed:master
npm run seed:geo-boundaries
npm run simulate:tracking
npm run dev
```

Then in another terminal (or Swagger):

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"hqadmin","password":"hqadmin123"}'

# Use the token returned above
curl http://localhost:5000/api/v1/tuk -H "Authorization: Bearer <TOKEN>"
```

## Project Layout

```
src/
  app.js              Express app + middleware
  config/             db, swagger, env validation, seed users
  controllers/        request handlers per resource
  middleware/         auth, validation
  models/             Mongoose schemas
  routes/             route definitions + Swagger annotations
  validators/         express-validator chains
scripts/
  seedMasterData.js
  seedGeoBoundaries.js
  simulateTrackingData.js
  stressTest.js
test/
  api.test.js         supertest integration tests
docs/
  REPORT.md           Coursework report
  SECURITY_IMPLEMENTATION_PLAN.md
  P1_TRANSPORT_AND_SECRETS_RUNBOOK.md
  AWS_AND_CI_CD.md
  GITHUB_SECRETS_CHECKLIST.md
  API_TEST_AND_CURL_GUIDE.md
```

## Deployment

Deployed to AWS EC2 with PM2, using GitHub Actions for CI/CD on push to `main`. See `docs/AWS_AND_CI_CD.md` for the full setup and `docs/GITHUB_SECRETS_CHECKLIST.md` for required secrets.

## License

ISC.
