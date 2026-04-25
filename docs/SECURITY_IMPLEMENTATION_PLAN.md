# API Security Implementation Plan (Step-by-Step)

This plan is for implementing practical API security controls one by one for this project.
It is intentionally scoped for coursework + real-world baseline hardening.

---

## How to use this plan

- Complete phases in order (P0 -> P4).
- After each phase, run verification checks and capture evidence (terminal output, screenshots, curl results).
- Do not move to the next phase until the current one passes.

---

## P0 - Baseline and inventory (do first)

### Goals

- Confirm current security controls and known gaps.
- Create a clean baseline before changing behavior.

### Tasks

- [x] Run tests and lint.
- [x] Export list of routes and roles allowed per route.
- [x] Confirm current environment variables in local + EC2 (without exposing secret values).
- [x] Confirm production uses HTTPS endpoint in front of the API.

### Verify

- `npm test` passes.
- `npm run lint` passes.
- You can list all protected routes from Swagger/curl and map them to expected roles.

### P0 execution notes (completed)

**Run status**

- `npm test`: pass (`3/3` tests).
- `npm run lint`: pass.

**Route and role inventory**

- `/province`: create/update/delete = `HQ_ADMIN`; list/get-by-id = `HQ_ADMIN`, `PROVINCE_ADMIN`, `DISTRICT_OFFICER`, `STATION_OFFICER`.
- `/district`: create/update/delete = `HQ_ADMIN`; list/get-by-id = `HQ_ADMIN`, `PROVINCE_ADMIN`, `DISTRICT_OFFICER`, `STATION_OFFICER`; list uses scope middleware.
- `/police-station`: create/update/delete = `HQ_ADMIN`; list/get-by-id = `HQ_ADMIN`, `PROVINCE_ADMIN`, `DISTRICT_OFFICER`, `STATION_OFFICER`; list uses scope middleware.
- `/tuk`: create/list/get/update/delete + last-location = `HQ_ADMIN`, `PROVINCE_ADMIN`, `DISTRICT_OFFICER`, `STATION_OFFICER`; list/write use scope middleware.
- `/location-ping`: create = `HQ_ADMIN`, `PROVINCE_ADMIN`, `DISTRICT_OFFICER`, `STATION_OFFICER`, `DEVICE`; list = all except `DEVICE`; list/write use scope middleware.

**Environment variable inventory (names only)**

- Local `.env` currently contains: `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
- Security middleware also supports: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`, `CORS_ORIGIN`.
- Deployment docs indicate EC2 should also define `PORT`, `MONGO_URI`, `JWT_SECRET` on server.

**HTTPS status**

- Current deployment guide shows direct `http://<EC2_IP>:5000` usage and notes 80/443 with proxy as optional.
- Conclusion: production HTTPS fronting is **not yet enforced** and should be done in P1.

---

## P1 - Transport and secret hygiene (high impact)

### Goals

- Ensure encrypted transport.
- Ensure secrets are managed safely.

### Tasks

- [x] Enforce HTTPS in deployment path (Nginx/ALB/Cloudflare redirect HTTP -> HTTPS).
- [x] Use strong `JWT_SECRET` (long random value) in production.
- [x] Remove fallback/default secrets in production config.
- [ ] Keep `.env` out of git and rotate compromised secrets.
- [ ] Verify Mongo Atlas network restrictions (IP allow list only where needed).

### Verify

- `http://<host>` redirects to `https://<host>`.
- API still works over HTTPS.
- Login fails if wrong secret is used to verify old tokens (expected after rotation).

### P1 execution notes

- Added startup env validation (`MONGO_URI`, `JWT_SECRET`) in `src/config/env.js` and `server.js`.
- Removed JWT fallback secret in:
  - `src/controllers/authController.js`
  - `src/middleware/authMiddleware.js`
- Added deployment runbook: `docs/P1_TRANSPORT_AND_SECRETS_RUNBOOK.md` with:
  - Nginx reverse proxy setup
  - Let's Encrypt HTTPS + redirect
  - security group tightening
  - JWT/Mongo secret rotation steps
  - verification commands and report evidence list

---

## P2 - Authentication and authorization tightening

### Goals

- Ensure role and scope checks are consistent on all endpoints.
- Minimize unauthorized data exposure.

### Tasks

- [ ] Review every `GET /:id` endpoint for scope checks (province/district/station/tuk).
- [ ] Ensure station/district/province users cannot read unrelated records by ID.
- [ ] Keep DEVICE role write-only for location ping (no broad read endpoints).
- [ ] Validate JWT claims used for scoping (`provinceId`, `districtId`, `stationId`, `tukId` if used).

### Verify

- Run negative tests:
  - `DISTRICT_OFFICER` reading another district's records => `403`
  - `STATION_OFFICER` reading another station's records => `403`
  - `DEVICE` trying to list protected resources => `403`
- Positive tests still pass for allowed resources.

---

## P3 - Abuse resistance (DDoS/brute-force mitigation)

### Goals

- Reduce impact of high-rate request floods and login abuse.

### Tasks

- [x] Add global rate limiter.
- [x] Add stricter auth/login limiter.
- [x] Add request body size limit.
- [x] Add baseline security headers (`helmet`) and CORS policy.
- [ ] Tune limiter values for local, staging, and production traffic.
- [ ] Document expected `429` behavior for clients.

### Verify

- Run stress script:
  - `npm run stress:test`
- Expected result:
  - Early requests hit endpoint logic (e.g., `401` for bad login),
  - Most flood traffic receives `429`,
  - Server remains responsive (no crash / timeout spikes).

---

## P4 - Visibility, incident response, and supply-chain safety

### Goals

- Detect attacks quickly.
- Keep dependencies and CI safer.

### Tasks

- [ ] Add structured logs for auth failures, 403, and 429 spikes.
- [ ] Track request volume and error rates (basic monitoring dashboard/log queries).
- [ ] Add dependency audit step (`npm audit`) in CI.
- [ ] Keep ESLint + tests mandatory in CI.
- [ ] Enable GitHub secret scanning and branch protections.

### Verify

- CI blocks merging when tests/lint fail.
- Security audit findings are reviewed and documented.
- Logs clearly show brute-force/rate-limit events.

---

## Test plan for security controls

Use this quick matrix when validating:

| Control | Test | Expected |
|---|---|---|
| HTTPS | Call HTTP URL | Redirect to HTTPS |
| JWT auth | Call protected route without token | `401` |
| Role auth | Call route with wrong role | `403` |
| Scope auth | Cross-region/area resource access | `403` |
| Validation | Send invalid lat/lon/ObjectId | `400` |
| Rate limit | Flood login endpoint | Significant `429` responses |
| Body size limit | Send oversized JSON payload | `413` or blocked request |
| CORS | Call from non-allowed origin (prod policy) | Blocked by CORS policy |

---

## Suggested execution order (day-by-day)

### Day 1

- Finish P0 and P1.
- Capture evidence screenshots/logs.

### Day 2

- Finish P2 authorization tightening + negative tests.

### Day 3

- Run P3 stress tests, tune limits, document results.

### Day 4

- Complete P4 CI/logging checks and final review.

---

## Definition of done (security for this coursework)

All conditions below should be true:

- [ ] Protected routes consistently enforce auth and role/scope access.
- [ ] HTTPS is active in deployment path.
- [ ] Secrets are managed outside source control.
- [ ] Rate limiting and basic abuse protection are active and tested.
- [ ] Input validation covers key request paths.
- [ ] CI enforces lint/tests and includes dependency checks.
- [ ] Security evidence is documented for report/demo.

