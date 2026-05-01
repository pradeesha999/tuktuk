# Manual end-to-end test playbook (realistic roles, mostly GETs)

Use this to **walk through the API like real clients**: HQ, province ops, district/station officers, and a device. The goal is to **confirm reads** (lists, filters, last location, history) match expectations.

**Swagger:** open `http://localhost:5000/api-docs` (or your EC2 URL + `/api-docs`).  
Click **Authorize**, paste `Bearer <your_jwt>` after login. Most **GET** endpoints need no body—execute from Swagger.

**Note:** You still need **`POST /auth/login`** (and usually **`POST /location-ping`** for a fresh “device sent a ping” story). Everything else below can be **GET-only** once data exists.

---

## 0) One-time data setup (local / demo DB)

From project root (same DB as in `.env`; production uses `webapi_prod` if configured):

```powershell
npm run seed:master
npm run seed:geo-boundaries
npm run simulate:tracking
```

| Script | What you get |
|--------|----------------|
| `seed:master` | Provinces, districts, police stations |
| `seed:geo-boundaries` | GeoJSON on provinces/districts → **`resolvedProvince` / `resolvedDistrict`** on pings |
| `simulate:tracking` | Many tuks + ~1 week of pings for history / current-area tests |

If you skip geo boundaries, pings may have **null** `resolved*` and geographic filters look empty.

---

## 1) “Software in front” — who calls what

| Persona | Typical reads | Typical writes (minimal for your test) |
|---------|----------------|----------------------------------------|
| **HQ admin** | All lists, any id | Login; optional CRUD if you create custom demo rows |
| **Province admin** | Tuks/pings/**current-area** scoped to **their province** | Login only if user has `provinceId` in JWT |
| **District / station officer** | Scoped lists + current-area | Login only if JWT has correct scope |
| **Device / tracker** | — | Login + **`POST /location-ping`** (only way to ingest GPS) |

Scoped roles **must** have matching **`provinceId` / `districtId` / `stationId`** on the **User** record (or they get **403** on scoped routes). Demo `authUsers` entries often **lack** those ids—use **`POST /auth/register`** as HQ to create a **PROVINCE_ADMIN** user with a real `provinceId` from **`GET /province`**.

---

## 2) Baseline: HQ — see the whole catalogue (GET chain)

Log in as HQ (`hqadmin` / `hqadmin123` if using default seed users).

Execute in order (all **GET**):

1. **`GET /province`** — full province list (active only after soft-delete feature).
2. **`GET /district`** — optional query `?provinceId=<id>` to narrow.
3. **`GET /police-station`** — optional `?provinceId=` or `?districtId=`.
4. **`GET /tuk`** — fleet list; optional `?provinceId=` / `?districtId=` / `?stationId=` (**registration** filters, not live GPS).
5. **`GET /location-ping`** — optional `?from=` `?to=` ISO datetimes; optional `?tukId=` — filters use **resolved** geography when you add `?provinceId=` / `?districtId=`.
6. **`GET /tuk/current-area`** — optional `?maxAgeMinutes=` — **live picture** from latest pings (needs geo seed + recent pings).

Copy **one** `tuk` `_id` and **one** `province` `_id` for later steps.

**Spot checks**

- **`GET /province/{id}`**, **`GET /district/{id}`**, **`GET /police-station/{id}`**, **`GET /tuk/{id}`** — single-document reads.
- **`GET /tuk/{id}/last-location`** — last ping for that vehicle (any age).

---

## 3) Province ops — “what’s in my province?”

**Prerequisite:** a user with role **`PROVINCE_ADMIN`** and **`provinceId`** set to a real province `_id` (register via HQ or edit Mongo).

Log in as that user → Swagger **Authorize** with new token.

**GET (scoped automatically from JWT — you often omit query):**

| Goal | Endpoint |
|------|----------|
| Vehicles **registered** in my province (home districts) | **`GET /tuk`** |
| Vehicles whose **latest ping** resolves **inside** my province + staleness window | **`GET /tuk/current-area`** — try `?maxAgeMinutes=120` if default is too tight |
| Raw ping stream in my province | **`GET /location-ping`** — scoped to resolved province |

**Past movement of one vehicle**

1. Pick **`TUK_ID`** from **`GET /tuk`** (same province registration).
2. **`GET /location-ping?tukId={TUK_ID}&from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z`** (adjust dates to your simulated data).

---

## 4) Device → officers see it (minimal writes)

**A)** Log in as **`device_user`** (must have **`tukId`** on **User** in DB for DEVICE scope—register a DEVICE user bound to a real tuk if demo user fails).

**B)** **`POST /location-ping`** with body like:

```json
{
  "latitude": 6.9271,
  "longitude": 79.8612,
  "pingedAt": "2026-05-01T12:00:00.000Z",
  "speedKmh": 25,
  "heading": 90
}
```

(`tuk` is injected from token for DEVICE.)

**C)** Log in as **HQ** or **province admin** (with correct `provinceId`).

**D)** **GET** checks:

- **`GET /location-ping`** — newest ping first; filter by time/`tukId`.
- **`GET /tuk/current-area`** — includes that tuk if ping is **recent** enough and **resolved** province/district matches filters + staleness.
- **`GET /tuk/{id}/last-location`** — coordinates should match latest ping.

---

## 5) District / station officer (GET)

After registering **`DISTRICT_OFFICER`** / **`STATION_OFFICER`** users with **`districtId`** / **`stationId`**:

| Endpoint | What to verify |
|----------|----------------|
| **`GET /district`** | Scoped list |
| **`GET /police-station`** | Scoped list |
| **`GET /tuk`** | Scoped fleet |
| **`GET /location-ping`** | Scoped pings |
| **`GET /tuk/current-area`** | Station officer: only tuks for **their station** + recent ping in district |

---

## 6) Entity checklist — “everything that can be read”

Use Swagger **GET** rows only for a smoke pass.

| Entity | GET endpoints |
|--------|----------------|
| **Province** | `/province`, `/province/{id}` |
| **District** | `/district`, `/district/{id}` (`?provinceId=` on collection) |
| **Police station** | `/police-station`, `/police-station/{id}` (`?districtId=` / `?provinceId=` on collection) |
| **Tuk** | `/tuk`, `/tuk/{id}`, `/tuk/current-area`, `/tuk/{id}/last-location` |
| **Location ping** | `/location-ping` (`?tukId`, `?provinceId`, `?districtId`, `?from`, `?to`) |

**Auth**

- **`POST /auth/login`** — obtain JWT (only non-GET you need repeatedly).

---

## 7) Swagger tips

- After **Authorize**, **GET** requests need **no body** — click **Execute**.
- For **query parameters**, fill the parameter boxes (Swagger builds the URL).
- If you see **403** on scoped routes, fix **User** scope ids or use **HQ** to confirm the route works without scope.

---

## 8) Quick “all GETs” PowerShell (HQ token)

After `$TOKEN` is set like in `API_TEST_AND_CURL_GUIDE.md`:

```powershell
$BASE="http://localhost:5000/api/v1"
$H = @{ Authorization = "Bearer $TOKEN" }

Invoke-RestMethod -Uri "$BASE/province" -Headers $H
Invoke-RestMethod -Uri "$BASE/district" -Headers $H
Invoke-RestMethod -Uri "$BASE/police-station" -Headers $H
Invoke-RestMethod -Uri "$BASE/tuk" -Headers $H
Invoke-RestMethod -Uri "$BASE/tuk/current-area" -Headers $H
Invoke-RestMethod -Uri "$BASE/location-ping" -Headers $H
```

Replace with **`?provinceId=`** etc. as needed.

---

## 9) What “success” looks like

- Lists return **JSON arrays** (200), not errors.
- **`/tuk/current-area`** returns tuks only if **latest ping** is within **`maxAgeMinutes`** and boundaries resolved (geo seed).
- **`/location-ping`** with **`from`/`to`** returns pings only for **active** tuks (soft-delete aware).
- Scoped users see **only** data their JWT allows; wrong scope → **403**.

---

*Optional:* run **`npm test`** for automated regression; this document is for **your own** scenario testing in Swagger or PowerShell.
