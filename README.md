# Tuk Tracking API

REST API built with Node.js, Express, and MongoDB for managing tuk records and province master data.

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

Server runs at:

`http://localhost:5000`

## Current API Endpoints

Base URL:

`http://localhost:5000/api/v1`

### Tuk

- `POST /tuk`
- `GET /tuk`
- `GET /tuk/:id`
- `PUT /tuk/:id`
- `DELETE /tuk/:id`

Example Tuk payload:

```json
{
  "registrationNumber": "ABC-1234",
  "deviceId": "dev-001",
  "ownerName": "Jane",
  "district": "Colombo"
}
```

### Province

- `POST /province`
- `GET /province`
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

## Tech Stack

- Node.js (ES Modules)
- Express
- Mongoose + MongoDB Atlas
- Nodemon
