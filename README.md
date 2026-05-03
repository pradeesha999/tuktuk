# Tuk-Tuk Tracking API

A RESTful Web API for tracking three-wheelers (tuk-tuks) and their movement history, designed for use by police headquarters, provincial offices, district offices and police stations. The API exposes administrative geography (provinces, districts, stations), registered vehicles, and a high-volume location-ping pipeline, with role-based access and GeoJSON-aware geographic filtering.

> Author: Pradeesha Hettiarachchi · Student ID: COBSCCOMP242P-052

**Live API:** [`https://webapi-tuktuk.duckdns.org`](https://webapi-tuktuk.duckdns.org)
**Swagger UI:** [`https://webapi-tuktuk.duckdns.org/api-docs/`](https://webapi-tuktuk.duckdns.org/api-docs/)

---

## Features

- **JWT authentication** with `bcrypt` password hashing.
- **Five roles** with progressively narrower scope: `HQ_ADMIN`, `PROVINCE_ADMIN`, `DISTRICT_OFFICER`, `STATION_OFFICER`, `DEVICE`.
- **GeoJSON boundary resolution** — every ping is tagged with the district and province it actually fell inside, using a `2dsphere` index and `$geoIntersects`.
- **Jurisdiction-aware visibility** — officers see all pings for vehicles registered in their patch, plus transit pings (plate-only) for foreign vehicles passing through.
- **Filtering, client-controlled sorting, pagination, and conditional GET** — `?provinceId=`, `?districtId=`, `?from=`, `?to=`, `?sort=-pingedAt`, `?skip=`, `?limit=`, plus `ETag` / `If-None-Match` for `304 Not Modified` responses.
- **Pagination headers** — `X-Total-Count` and RFC 5988 `Link` (`rel="next"` / `rel="prev"`).
- **Rate limiting** — global limiter plus a stricter limiter on `/auth/*`.
- **Soft delete** across all resources so historical references are never broken.
- **OpenAPI 3.0 documentation** generated from JSDoc, served at `/api-docs`.
- **Reproducible demo data** — scripts to seed master data and 200 vehicles with a week of simulated pings.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js (ES modules) |
| HTTP | Express 5 |
| Data | MongoDB (Atlas) + Mongoose |
| Auth | JSON Web Tokens, `bcryptjs` |
| Validation | `express-validator` |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Docs | `swagger-jsdoc` + `swagger-ui-express` |
| Tests | `node:test`, `supertest`, `mongodb-memory-server` |
| Process manager | PM2 (production) |
| Reverse proxy / TLS | Nginx + Let’s Encrypt |
| CI/CD | GitHub Actions → AWS EC2 |

---

## Quick start

```bash
git clone https://github.com/pradeesha999/tuktuk
cd tuktuk
npm install
cp .env.example .env   # then edit
npm run dev            # development with nodemon
```

The server listens on `PORT` (default `5000`). Swagger UI is at `http://localhost:5000/api-docs`.

---

## Environment variables

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign JSON Web Tokens |
| `PORT` | No | HTTP port, defaults to `5000` |
| `MONGO_DB_NAME` | No | Database name, defaults to `webapi_prod` |
| `JWT_EXPIRES_IN` | No | Token lifetime (`12h` by default) |
| `CORS_ORIGIN` | No | Allowed origin, defaults to `*` |
| `SWAGGER_SERVER_URL` | No | OpenAPI `servers` URL, defaults to `/api/v1` |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | No | Global rate limit |
| `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` | No | Stricter limit for `/auth/*` |
| `LAST_PING_AREA_MAX_AGE_MINUTES` | No | Stale cutoff for `GET /tuk/last-ping-area` |
| `AUTH_USERS` | No | JSON array of fallback dev users |

Sensible defaults exist for everything except the two required entries.

---

## Demo data scripts

Run **in order** against the database the API uses (`MONGO_DB_NAME`, default `webapi_prod`):

```bash
npm run seed:master           # 9 provinces, 25 districts, 25 stations
npm run seed:geo-boundaries   # GeoJSON polygons from OpenStreetMap (Nominatim)
npm run simulate:tracking     # 200 tuks + ~1 week of pings
npm run export:simulation     # dump JSON + CSV artefacts to ./data
```

`seed:geo-boundaries` requires outbound HTTPS and is rate-limited at one request per second to respect Nominatim policy. `simulate:tracking` keeps each vehicle inside its home district polygon and writes `source: "simulated"` so future runs replace prior simulated pings without touching real data. `export:simulation` produces matching JSON and CSV pairs under `data/` for provinces, districts, police stations, and tuks, plus `data/location_pings.json` and `data/location_pings.csv` (pings are filtered to `source: "simulated"`).

---

## Authentication and roles

| Role | Capabilities |
|------|--------------|
| `HQ_ADMIN` | Full CRUD on geography, vehicles, users; sees all pings |
| `PROVINCE_ADMIN` | Read/write within one province |
| `DISTRICT_OFFICER` | Read/write within one district |
| `STATION_OFFICER` | Read/write within one police station |
| `DEVICE` | `POST /location-ping` for one bound vehicle (and read its own history) |

`POST /api/v1/auth/login` returns a JWT containing the user's role and any scope ids (`provinceId`, `districtId`, `stationId`, `tukId`). All other endpoints require `Authorization: Bearer <jwt>`.

`POST /api/v1/auth/register` is restricted to `HQ_ADMIN` and creates a database user with a hashed password and the relevant scope id.

---

## REST API surface (v1)

All endpoints are under `/api/v1`. The full specification, including request bodies and response shapes, is in Swagger.

| Resource | Path | Notes |
|----------|------|-------|
| Authentication | `/auth/login`, `/auth/register` | `register` is HQ-only |
| Province | `/province` | `?includeBoundary=true` to retrieve polygon |
| District | `/district` | Optional `?provinceId=` |
| Police station | `/police-station` | Optional `?provinceId=` / `?districtId=` |
| Tuk | `/tuk`, `/tuk/:id/last-location`, `/tuk/last-ping-area` | Geographic filters honoured per role; `POST /tuk` as `STATION_OFFICER` needs only `registrationNumber` and `deviceId` (district and station are taken from the token) |
| Location ping | `/location-ping` | `POST` is `DEVICE`-only |

List endpoints share a common shape:

- **Filter**: `provinceId`, `districtId`, `stationId`, `tukId`, `from`, `to`.
- **Sort**: `?sort=field` ascending or `?sort=-field` descending. Each endpoint whitelists which fields are sortable.
- **Paginate**: `?skip=`, `?limit=` (default 100, max 500). Responses include `X-Total-Count` and a `Link` header with `rel="next"` and `rel="prev"`.
- **Conditional GET**: every JSON response carries an `ETag`. Resending the request with `If-None-Match: "<etag>"` returns `304 Not Modified` with no body when nothing changed.

---

## Project layout

```
server.js                       Entry point: env validation, DB connect, listen
src/
  app.js                        Express app, middleware, route mounting
  config/                       db, env, swagger, fallback dev users
  controllers/                  Request handlers per resource
  middleware/                   JWT auth, RBAC scope, validation
  models/                       Mongoose schemas
  routes/                       REST routes + OpenAPI annotations
  utils/                        Soft-delete helpers, sort/pagination,
                                geo response shaping, jurisdiction rules,
                                geographic resolution
  validators/                   express-validator chains
scripts/                        Seed, simulate, export, migrate, stress
test/                           Integration tests (supertest)
docs/                           Project documentation
```

---

## Tests and lint

```bash
npm test           # integration tests with supertest + memory MongoDB
npm run lint:ci    # ESLint with --max-warnings 0
```

The CI workflow (`.github/workflows/ci.yml`) runs both on every push and pull request.

---

## Deployment

The production deployment runs on Ubuntu on AWS EC2. PM2 supervises the Node process and Nginx terminates TLS using a Let's Encrypt certificate (auto-renewed by certbot). The API listens on `127.0.0.1:5000` while Nginx exposes `443/tcp` to the public internet; port `5000` is not open in the security group. CI on `main` runs lint and tests, then connects over SSH to pull, install with `npm ci --omit=dev`, and `pm2 restart`.

---

## License

ISC.
