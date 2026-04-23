# Tuk Tracking API

REST API built with Node.js, Express, and MongoDB for tuk records, movement logs, administrative boundaries, and police station master data.

## Prerequisites

- Node.js 18+ (or latest LTS)
- npm
- MongoDB Atlas cluster (or MongoDB instance)

## Project Setup

1. Clone the repository
2. Install dependencies

```bash
npm install
```

3. Create a `.env` file in the project root with:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
```

Notes:
- If your DB password contains special characters (like `@`), URL-encode them in `MONGO_URI`.
- In MongoDB Atlas, make sure your current IP is added in Network Access.

## Run the Project

Development mode (nodemon):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

Run tests:

```bash
npm test
```

Seed master data (9 provinces, 25 districts, stations):

```bash
npm run seed:master
```

Generate simulation data (200 tuks + 1 week pings):

```bash
npm run simulate:tracking
```

Server runs at:

`http://localhost:5000`

## Current API Endpoints

Base URL:

`http://localhost:5000/api/v1`

### Tuk

- `POST /tuk`
- `GET /tuk` (optional: `districtId`, `provinceId`, `stationId`, `page`, `limit`, `sort`, `order`)
- `GET /tuk/:id`
- `GET /tuk/:id/last-location`
- `PUT /tuk/:id`
- `DELETE /tuk/:id`

Example Tuk payload:

```json
{
  "registrationNumber": "ABC-1234",
  "deviceId": "dev-001",
  "ownerName": "Jane",
  "district": "paste_district_mongodb_id_here",
  "policeStation": "paste_station_mongodb_id_here"
}
```

### Province

- `POST /province`
- `GET /province` (optional: `page`, `limit`, `sort`, `order`)
- `GET /province/:id`
- `PUT /province/:id`
- `DELETE /province/:id`

Example Province payload:

```json
{
  "name": "Western",
  "code": "WP"
}
```

### District

- `POST /district`
- `GET /district` (optional: `provinceId`, `page`, `limit`, `sort`, `order`)
- `GET /district/:id`
- `PUT /district/:id`
- `DELETE /district/:id`

Example District payload (`province` is a Province document `_id`):

```json
{
  "name": "Colombo",
  "code": "CO",
  "province": "paste_province_mongodb_id_here"
}
```

### Police station

- `POST /police-station`
- `GET /police-station` (optional: `districtId`, `provinceId`, `page`, `limit`, `sort`, `order`)
- `GET /police-station/:id`
- `PUT /police-station/:id`
- `DELETE /police-station/:id`

Example Police station payload (`district` is a District document `_id`):

```json
{
  "name": "Colombo Fort Police Station",
  "code": "CMB-FT-01",
  "district": "paste_district_mongodb_id_here"
}
```

### Location Ping

- `POST /location-ping`
- `GET /location-ping` (optional: `tukId`, `districtId`, `provinceId`, `from`, `to`, `page`, `limit`, `sort`, `order`)

Example Location Ping payload:

```json
{
  "tuk": "paste_tuk_mongodb_id_here",
  "latitude": 6.9271,
  "longitude": 79.8612,
  "pingedAt": "2026-04-21T10:00:00.000Z",
  "speedKmh": 32.5,
  "heading": 145,
  "source": "device"
}
```

## Response Notes

- List endpoints return:
  - `data`: array
  - `meta`: pagination info
- Conditional GET support:
  - Response includes `ETag`
  - Send `If-None-Match` to receive `304 Not Modified` when unchanged

## Quick Verification Checklist

1. `npm run seed:master`
2. `npm run simulate:tracking`
3. `npm run dev`
4. Verify:
   - `GET /api/v1/province?page=1&limit=5&sort=name&order=asc`
   - `GET /api/v1/district?provinceId=<id>`
   - `GET /api/v1/police-station?provinceId=<id>`
   - `GET /api/v1/tuk?districtId=<id>`
   - `GET /api/v1/location-ping?tukId=<id>&from=<iso>&to=<iso>`
   - `GET /api/v1/tuk/<id>/last-location`

## Tech Stack

- Node.js (ES Modules)
- Express
- Mongoose + MongoDB Atlas
- Nodemon
- Supertest + mongodb-memory-server (tests)
