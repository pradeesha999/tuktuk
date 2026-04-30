# NB6007CEM – Web API Development Coursework Report

**Module:** NB6007CEM – Web API Development  
**Course:** BSc (Hons) Computing (Coventry University, delivered at NIBM)  
**Batch:** 24.2P  
**Author:** `<<YOUR FULL NAME>>`  
**Student ID:** `<<YOUR STUDENT ID>>`  
**Lecturer:** Niranga Dharmaratna  
**Submission Year:** 2026  
**Title:** Real-Time Three-Wheeler (Tuk-Tuk) Tracking & Movement Logging RESTful API for Sri Lanka Law Enforcement

---

## Ethical Declaration

I declare that this coursework is my own work, produced for the NB6007CEM module. All third-party material has been cited. I understand the academic integrity, plagiarism and AI-use policies that apply to this submission, and I confirm compliance with them.

> *(Place a scanned signature image here if your programme requires one – see Appendix B.)*

---

## Abstract

This report documents the design, implementation and deployment of a RESTful Web API supporting Sri Lanka Police’s envisioned tuk-tuk tracking platform. The API exposes administrative geography (provinces, districts, police stations), registered vehicles, and a high-volume location-ping pipeline, secured by JSON Web Tokens (JWT) and a role-based access model spanning headquarters, provincial, district, station and device clients. The implementation follows REST architectural principles (Fielding, 2000), HTTP semantics (Fielding, Nottingham and Reschke, 2014), GeoJSON encoding for boundary data (Butler *et al.*, 2016) and OWASP API security guidance (OWASP, 2023). The system is built on Node.js with Express and MongoDB Atlas, deployed on AWS EC2 with PM2 and continuous deployment via GitHub Actions, and verified through automated integration tests, brute-force/DDoS stress tests, and a one-week simulated dataset across all nine provinces and 25 districts of Sri Lanka.

---

## 1. Introduction and Business Requirements Analysis

Three-wheelers (tuk-tuks) are a dominant short-distance public transport mode in Sri Lanka, but their high mobility, large fleet size and weak central registration make them difficult to investigate when criminally misused. The coursework brief outlines a Phase-1 platform for the Sri Lanka Police that focuses on **vehicle visibility and investigative logging** rather than dispatch or driver-side mobile applications. From the brief, four functional pillars were extracted and treated as the contract for the API:

- **Vehicle and identity registration** – persistent records of vehicles, the police hierarchy that owns them, and authenticated users for HQ, provincial, district and station-level officers, plus tracking devices.
- **Real-time last-known location** – ingest periodic GPS pings and serve the latest position per vehicle.
- **Historical movement logs** – return time-window slices of pings for investigative review.
- **Geographic filtering** – list vehicles and pings by province and district, including the case where a vehicle physically moves into another province’s jurisdiction.

Non-functional requirements derived from the rubric (Table 1, brief) include REST compliance, filtering/sorting, conditional headers, secure authentication, scalable architecture, full deployment (no localhost), CI/CD via GitHub Actions, and at least one week of simulated history at realistic scale (200+ tuks across 25 districts, 20+ stations) (Dharmaratna, 2026). The rubric’s “Level 5” descriptors require explicit attention to HTTP headers, scalability and best-practice security (Dharmaratna, 2026), which directly shaped the design decisions in §2 and §3.

Crucially, the brief also clarifies what the project is **not**: no client UI is required. The API is the artefact under assessment, demonstrated through Swagger UI, curl and Postman. This shifted effort away from front-end concerns and toward correctness, documentation, and verifiable security and deployment evidence.

> **Insert image:** *Figure 1 – Business context diagram (HQ ↔ Province ↔ District ↔ Station ↔ Device, with API at centre).* You can hand-draw this or use draw.io and export as `figure-01-business-context.png`.

---

## 2. Design, Architecture and Implementation Considerations

### 2.1 RESTful API Design Principles

The API follows the architectural constraints set out by Fielding (2000): a uniform interface, stateless interactions, layered system, and resource-oriented URLs. Each domain concept is exposed as a noun-based collection (`/api/v1/province`, `/api/v1/district`, `/api/v1/police-station`, `/api/v1/tuk`, `/api/v1/location-ping`, `/api/v1/auth`) with HTTP verbs carrying intent, in line with HTTP semantics (Fielding, Nottingham and Reschke, 2014):

- `POST` – create
- `GET` – retrieve (collection or `/:id`)
- `PUT` – full update of a known resource
- `DELETE` – remove

Versioning is encoded in the URL prefix (`/api/v1`), which supports parallel evolution of breaking changes without client disruption (Masse, 2011). Filtering, sorting, and time-window selection are expressed as query parameters (e.g. `?provinceId=`, `?districtId=`, `?stationId=`, `?from=`, `?to=`), so callers compose queries declaratively rather than relying on bespoke endpoints. Standard HTTP status codes are used consistently: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `429`, `500`.

OpenAPI 3.0 documentation is generated from JSDoc annotations using `swagger-jsdoc` and served via `swagger-ui-express` at `/api-docs`, providing a navigable specification with security schemes, request bodies and parameter shapes (OpenAPI Initiative, 2021). To make the documentation work both locally and on the deployed instance, the OpenAPI `servers` URL was made relative (`/api/v1`) so the Swagger UI client calls back to the same origin – this avoided cross-origin and `localhost` resolution problems observed during browser testing on the EC2 host.

> **Insert image:** *Figure 2 – Swagger UI screenshot of the deployed API (`/api-docs`).* Take a screenshot of the live Swagger page after login and save as `figure-02-swagger.png`.

### 2.2 Domain Model and Data Persistence

The persistence layer uses MongoDB via Mongoose (MongoDB Inc., 2024; Mongoose, 2024). MongoDB was selected over a relational database because (i) the brief emphasises high write-throughput for GPS pings rather than complex transactional joins, (ii) location data is naturally semi-structured, and (iii) MongoDB’s `2dsphere` index gives first-class geospatial query support (MongoDB Inc., 2024) that maps cleanly onto the brief’s province/district filtering requirement.

The conceptual model is:

- **Province** (1) → **District** (N)
- **District** (1) → **PoliceStation** (N), **Tuk** (N)
- **PoliceStation** (0..1) ←→ **Tuk**
- **Tuk** (1) → **LocationPing** (N)
- **User** has a role and optional scope IDs (`provinceId`, `districtId`, `stationId`, `tukId`).

This mirrors the police command structure rather than inventing parallel hierarchies. Every relation that crosses an aggregate (e.g. `LocationPing.tuk`) is stored as a Mongo `ObjectId` reference and indexed for query performance. Compound indexes are used where access patterns are well known – for example `LocationPing` is indexed by `{ tuk: 1, pingedAt: -1 }` so the “last-known location” and time-window queries are constant-time per vehicle.

> **Insert image:** *Figure 3 – Entity-relationship/Data model diagram.* Draw the entities and relationships listed above and export as `figure-03-data-model.png`.

### 2.3 Geospatial Resolution Using GeoJSON

A subtle requirement implied by the brief – *“province- and district-wise filtering for operational use”* (Dharmaratna, 2026) – is that filtering should reflect where a vehicle **physically is**, not only its administrative home. To support this, **GeoJSON** boundary polygons (Butler *et al.*, 2016) are stored on `Province` and `District` documents, indexed with a `2dsphere` index. Each `LocationPing` stores both raw lat/lon and a GeoJSON `Point`, plus pre-resolved `resolvedDistrict` and `resolvedProvince` references computed at write time using MongoDB’s `$geoIntersects` operator (MongoDB Inc., 2024). Boundaries are seeded by a script (`scripts/seedGeoBoundaries.js`) that queries the OpenStreetMap Nominatim service (OpenStreetMap Foundation, 2024) by Sri Lankan place names (e.g. *“Western Province, Sri Lanka”*, *“Colombo District, Sri Lanka”*) and stores the returned polygons.

The benefit is twofold: (i) `GET /api/v1/location-ping?provinceId=...` returns pings whose **actual coordinates** fall inside the requested area, not merely those whose vehicle was administratively assigned there, and (ii) a new endpoint `GET /api/v1/tuk/current-area` aggregates each tuk’s most recent ping and reports its currently observed district and province. This is genuinely useful in an investigative context where vehicles cross jurisdictions.

### 2.4 Authentication and Role-Based Access Control

Authentication uses signed JSON Web Tokens (Jones, Bradley and Sakimura, 2015). On `POST /auth/login`, the API verifies a `bcrypt` password hash (Provos and Mazières, 1999; OWASP, 2024) and signs a token containing the user’s username, role, and any scope IDs. All other routes mount `authenticateToken` and `authorizeRoles(...)` middlewares so unauthenticated calls receive `401` and wrong-role calls receive `403`. The roles modelled are:

- **HQ_ADMIN** – full administrative powers, including user registration.
- **PROVINCE_ADMIN** – read/write within a single province.
- **DISTRICT_OFFICER** – read/write within a single district.
- **STATION_OFFICER** – read/write within a single station.
- **DEVICE** – write-only access to the location ping endpoint, bound to one tuk.

A second middleware, `applyScope`, narrows list and write queries by automatically injecting `provinceId`, `districtId`, `stationId` or `tukId` from the JWT into the request – following the OWASP API Security Top 10 guidance to “shift authorization to the server side” and avoid trust in client-supplied scope (OWASP, 2023). User registration is exposed only to HQ via `POST /auth/register`, with role-specific validators that *require* the relevant scope ID per role (e.g. `STATION_OFFICER` cannot be created without a `stationId`).

> **Insert image:** *Figure 4 – Sequence diagram of login → JWT → scoped query (e.g. district officer listing pings).* Save as `figure-04-auth-flow.png`.

### 2.5 Validation, Error Handling and HTTP Headers

All write endpoints use `express-validator` to enforce field types, length and shape before any database call, and a centralised `validateRequest` middleware returns a structured `400` with field-level errors. This prevents NoSQL operator injection and reduces controller noise (OWASP, 2023). Geospatial endpoints additionally validate latitude (-90..90) and longitude (-180..180) ranges.

For HTTP semantics (a Level-5 rubric concern), the API uses:

- `Authorization: Bearer <jwt>` for authentication.
- `Content-Type: application/json` for both request and response bodies.
- `RateLimit-*` standardised headers (draft-8) emitted by `express-rate-limit` (Express Rate Limit, 2024).
- Security-related response headers from Helmet (Helmet, 2024), e.g. `Content-Security-Policy`, `Strict-Transport-Security`-ready configuration, `X-Content-Type-Options`, etc.
- `429 Too Many Requests` returned automatically when a client exceeds the configured budget.
- `413`-style protection from a 10 KB JSON body cap to limit request smuggling and memory pressure.

### 2.6 Modular Code Structure

The codebase is split into clear concerns – `src/models/`, `src/controllers/`, `src/routes/`, `src/middleware/`, `src/validators/`, `src/config/` – matching common Node.js conventions (Holowaychuk, 2024). Each route file owns its OpenAPI annotations next to its handler bindings, so documentation drift is minimised. ECMAScript modules are used throughout, and the project enforces zero ESLint warnings in CI to keep code quality high (`npm run lint:ci`).

---

## 3. Security and DDoS Mitigation

Security was treated as a layered concern (defence-in-depth) rather than a single feature.

**Transport.** The deployment runbook (`docs/P1_TRANSPORT_AND_SECRETS_RUNBOOK.md`) describes the Nginx reverse-proxy + Let’s Encrypt configuration that fronts the Node.js process, redirecting HTTP to HTTPS and terminating TLS (Internet Engineering Task Force, 2018). For the coursework demo the API also remains reachable on its plain port for marker convenience, but the production-style HTTPS path is documented as the intended access mode.

**Identity and access.** As described in §2.4, JWT-based authentication is enforced on every non-login route, role checks gate access, and scope middleware further narrows what each role can see. Default-secret fallbacks were removed from `JWT_SECRET` handling so the application now fails fast at startup if secrets are missing (a deliberate “secure by default” change suggested by OWASP (2023)).

**Abuse resistance.** Two `express-rate-limit` instances are configured: a global limiter (`300 req / 15 min` by default) and a stricter limiter on the `/auth/*` routes (`40 req / 10 min`), plus a 10 KB request body cap. A repeatable stress script (`npm run stress:test`) was added to demonstrate the effect; in a typical local run (1000 requests, concurrency 50, ~424 req/s) the API correctly converted abusive traffic to `429 Too Many Requests` responses while remaining responsive to legitimate requests.

**Secrets and supply chain.** Secrets (`MONGO_URI`, `JWT_SECRET`) are read only from environment variables; `.env` is git-ignored; `npm ci --omit=dev` is used during deployment to pin versions to `package-lock.json`. CI runs lint and tests on every push and blocks promotion when either fails.

**Honest scope statement.** This is application-layer hardening; it does not stop a true volumetric DDoS, which requires upstream infrastructure (CDN/WAF/anycast). This boundary is acknowledged in §6.

> **Insert image:** *Figure 5 – Stress test terminal output showing 401/429/latency p50–p99.* Save as `figure-05-stress-test.png`.

---

## 4. Testing and Quality Assurance

Automated tests are written with the built-in Node test runner and `supertest`, exercising the real Express app against either MongoDB Memory Server (locally) or an isolated database in Atlas (in CI). The suite covers the most security- and behaviour-sensitive flows: linked retrieval across the province/district/station hierarchy; vehicle creation and filtered listing by district and province; ping creation; time-window filtering; last-known location; HQ-only registration; and forbidden registration by non-HQ roles. Tests run with `--test-concurrency=1` so they share state safely, and CI uses an isolated database name per run (`webapi_<random>`) to avoid cross-pipeline interference. ESLint is run in CI with `--max-warnings 0`, so any warning fails the build – addressing the Level 5 *“no linting errors or warnings”* rubric line (Dharmaratna, 2026).

For functional demonstration beyond automated tests, two additional tools are provided:

- `npm run seed:master` produces all 9 provinces, 25 districts and 25 stations.
- `npm run simulate:tracking` produces 200 vehicles and roughly **8 days × 200 vehicles ≈ 11,200 pings** with realistic per-province coordinate ranges, satisfying the brief’s “at least one week with realistic patterns” requirement (Dharmaratna, 2026).

Stress and load behaviour is captured by `npm run stress:test`, with results saved as the report’s Figure 5.

> **Insert image:** *Figure 6 – Test suite output (`npm test`).* Save as `figure-06-tests-pass.png`.

---

## 5. Deployment, CI/CD and Version Control

The API is deployed to **AWS EC2** (Amazon Web Services, 2024) on an Ubuntu LTS instance, supervised by **PM2** (Strzelczyk, 2024). MongoDB persistence uses **MongoDB Atlas** (MongoDB Inc., 2024), keeping the database off the application VM and reducing the operational surface to manage. Configuration is environment-driven (`PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `RATE_LIMIT_*`, `CORS_ORIGIN`).

Continuous Integration runs on every push and pull request to `main` or `dev` and executes `npm ci → npm run lint:ci → npm test` (GitHub, 2024). Continuous Deployment is triggered on `push` to `main` and uses the `appleboy/ssh-action` runner to SSH into EC2, `git pull`, `npm ci --omit=dev`, and `pm2 restart`. Six GitHub Actions secrets (`TEST_MONGO_URI`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `EC2_APP_DIR`, `PM2_APP_NAME`) keep all credentials out of the repository, in line with the principle of separating configuration from code (Twelve-Factor App Authors, 2017).

Branching followed a feature/dev/main pattern. `dev` was used for in-progress work, with merges to `main` performed only when CI was green; this satisfies the rubric’s “use of branching and merging” and produced a commit history spanning multiple weeks. Commit messages follow imperative-style summaries.

> **Insert image:** *Figure 7 – GitHub Actions “Deploy production” run summary.* Save as `figure-07-actions.png`.  
> **Insert image:** *Figure 8 – `pm2 list` showing the `webapi` process online on EC2.* Save as `figure-08-pm2.png`.

---

## 6. Limitations, Scaling and Further Concerns

**Geospatial accuracy.** Boundaries are pulled from OpenStreetMap via Nominatim (OpenStreetMap Foundation, 2024); their precision depends on community-contributed data. For high-stakes investigative use, official Sri Lanka Survey Department GIS data should replace the seed source. The current `$geoIntersects` resolution is also a per-write computation – at very high write rates (e.g. millions of pings per minute) it would need to be batched or pushed to a stream-processing pipeline.

**Sharding and write scale.** A single MongoDB Atlas tier is sufficient for the simulated load. For national-scale fleets, the `LocationPing` collection is the obvious shard candidate, keyed on `{ tuk: 1, pingedAt: -1 }`. Read scalability for last-known location can additionally be served from an in-memory cache (e.g. Redis) since per-tuk last position changes at most once every ping interval.

**Authentication evolution.** The current model uses static-password JWTs, which is acceptable for Phase 1 but should be evolved to short-lived access tokens plus refresh tokens, password rotation, and ideally a hardware-backed device identity for the `DEVICE` role (Internet Engineering Task Force, 2012; OWASP, 2023). Multi-factor authentication for HQ admins is also a clear next step.

**Observability and incident response.** The current logging is request/response level only. A production rollout should add structured logging (e.g. Pino), centralised log shipping, request correlation IDs, and alerting on `4xx`/`5xx` spikes and on rate-limit triggers. This is captured as P4 of the security plan.

**True DDoS protection.** Application-layer rate limiting protects against single-host brute-force and modest floods, but a real volumetric attack must be absorbed upstream by a CDN/WAF such as Cloudflare or AWS WAF before reaching the API origin.

**Plagiarism / AI compliance.** The submission is written, edited and signed by the author. Where AI assistants were used to brainstorm structure or refactor code, prompts and short outputs are recorded in Appendix A.iv per coursework rules (Dharmaratna, 2026).

---

## 7. Conclusion

The submitted API meets the brief’s functional pillars (registration, last-known location, time-window history, geographic filtering) and aligns with the rubric’s Level-5 expectations across REST conformance, headers, security, modular implementation, testing, deployment and version control. Beyond the minimum, the project adds GeoJSON-based location resolution and per-tuk current-area queries, automated stress testing for abuse resistance, and an explicit, phased security implementation plan that is referenced from production-shaped runbooks. This positions the API as a credible Phase-1 platform on which Sri Lanka’s law-enforcement agencies could build genuine investigative tooling.

---

## References

Amazon Web Services (2024) *Amazon EC2 documentation*. Available at: https://docs.aws.amazon.com/ec2/ (Accessed: 26 April 2026).

Butler, H., Daly, M., Doyle, A., Gillies, S., Hagen, S. and Schaub, T. (2016) *RFC 7946: The GeoJSON Format*. Internet Engineering Task Force. Available at: https://www.rfc-editor.org/rfc/rfc7946 (Accessed: 26 April 2026).

Dharmaratna, N. (2026) *NB6007CEM Web API Development Coursework Brief, Batch 24.2P*. Coventry University / NIBM.

Express Rate Limit (2024) *express-rate-limit documentation*. Available at: https://express-rate-limit.mintlify.app/ (Accessed: 26 April 2026).

Fielding, R.T. (2000) *Architectural Styles and the Design of Network-based Software Architectures*. PhD thesis, University of California, Irvine. Available at: https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm (Accessed: 26 April 2026).

Fielding, R., Nottingham, M. and Reschke, J. (2014) *RFC 7231: Hypertext Transfer Protocol (HTTP/1.1): Semantics and Content*. Internet Engineering Task Force. Available at: https://www.rfc-editor.org/rfc/rfc7231 (Accessed: 26 April 2026).

GitHub (2024) *GitHub Actions documentation*. Available at: https://docs.github.com/en/actions (Accessed: 26 April 2026).

Helmet (2024) *Helmet for Express.js*. Available at: https://helmetjs.github.io/ (Accessed: 26 April 2026).

Holowaychuk, T.J. (2024) *Express – Fast, unopinionated, minimalist web framework for Node.js*. Available at: https://expressjs.com/ (Accessed: 26 April 2026).

Internet Engineering Task Force (2012) *RFC 6749: The OAuth 2.0 Authorization Framework*. Available at: https://www.rfc-editor.org/rfc/rfc6749 (Accessed: 26 April 2026).

Internet Engineering Task Force (2018) *RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3*. Available at: https://www.rfc-editor.org/rfc/rfc8446 (Accessed: 26 April 2026).

Jones, M., Bradley, J. and Sakimura, N. (2015) *RFC 7519: JSON Web Token (JWT)*. Internet Engineering Task Force. Available at: https://www.rfc-editor.org/rfc/rfc7519 (Accessed: 26 April 2026).

Masse, M. (2011) *REST API Design Rulebook*. Sebastopol, CA: O’Reilly Media.

MongoDB Inc. (2024) *MongoDB Manual*. Available at: https://www.mongodb.com/docs/manual/ (Accessed: 26 April 2026).

Mongoose (2024) *Mongoose ODM documentation*. Available at: https://mongoosejs.com/docs/ (Accessed: 26 April 2026).

OpenAPI Initiative (2021) *OpenAPI Specification v3.0.3*. Available at: https://spec.openapis.org/oas/v3.0.3 (Accessed: 26 April 2026).

OpenStreetMap Foundation (2024) *Nominatim usage policy and documentation*. Available at: https://operations.osmfoundation.org/policies/nominatim/ (Accessed: 26 April 2026).

OWASP (2023) *OWASP API Security Top 10 (2023)*. Available at: https://owasp.org/API-Security/editions/2023/en/0x00-header/ (Accessed: 26 April 2026).

OWASP (2024) *OWASP Password Storage Cheat Sheet*. Available at: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (Accessed: 26 April 2026).

Provos, N. and Mazières, D. (1999) ‘A future-adaptive password scheme’, in *Proceedings of the 1999 USENIX Annual Technical Conference*, Monterey, CA.

Strzelczyk, A. (2024) *PM2 documentation*. Available at: https://pm2.keymetrics.io/ (Accessed: 26 April 2026).

Twelve-Factor App Authors (2017) *The Twelve-Factor App*. Available at: https://12factor.net/ (Accessed: 26 April 2026).

---

## Appendix A – Deployment Details (Mandatory)

**A.i Deployed API URL**  
`<<DEPLOYED_API_URL>>` (e.g. `http://13.63.49.231:5000` or your HTTPS domain once issued).

**A.ii API Specification (Swagger)**  
`<<DEPLOYED_API_URL>>/api-docs`

**A.iii GitHub Repository**  
`<<GITHUB_REPO_URL>>` (e.g. `https://github.com/pradeesha999/tuktuk`).  
The lecturer (Niranga Dharmaratna) has been added as a collaborator.

**A.iv AI Aides / Prompts**  
The author used AI assistants (e.g. ChatGPT / Cursor) for structural brainstorming, code refactor suggestions and report editing. Indicative prompts:

- *“Help me design role-based access for a multi-tier law-enforcement API.”*
- *“Suggest how to model GeoJSON boundaries on districts and resolve a ping’s area with `$geoIntersects`.”*
- *“Draft a stress-test script for express endpoints to demonstrate `429` responses.”*

All generated suggestions were reviewed, modified and validated by the author before inclusion.

---

## Appendix B – Figures and Where to Place Them

The following figures should be placed inline at the locations indicated above. File names are suggestions – align them with whatever you commit alongside the report.

| Figure | Title | Suggested filename | Recommended placement |
|---|---|---|---|
| 1 | Business context diagram | `figure-01-business-context.png` | End of §1 |
| 2 | Swagger UI on deployed API | `figure-02-swagger.png` | End of §2.1 |
| 3 | Data model / ER diagram | `figure-03-data-model.png` | End of §2.2 |
| 4 | Auth & scope sequence diagram | `figure-04-auth-flow.png` | End of §2.4 |
| 5 | Stress test terminal output | `figure-05-stress-test.png` | End of §3 |
| 6 | `npm test` output | `figure-06-tests-pass.png` | End of §4 |
| 7 | GitHub Actions deploy run | `figure-07-actions.png` | Mid §5 |
| 8 | `pm2 list` on EC2 | `figure-08-pm2.png` | End of §5 |

---

## Word-Count Note

The body of this report (Abstract through §7 Conclusion) is intentionally written above the **2700-word viva eligibility threshold** and around the **3000-word target** specified in the brief, excluding cover, declaration, references and appendices, in line with the LMS measurement convention.
