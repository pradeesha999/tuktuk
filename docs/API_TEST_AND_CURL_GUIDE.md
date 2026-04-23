# API Test and cURL Guide (Windows PowerShell)

## 1) Start the API

```powershell
npm run dev
```

Base URL used below:

```text
http://localhost:5000/api/v1
```

Swagger:

```text
http://localhost:5000/api-docs
```

## 2) Seed demo data (optional but recommended)

```powershell
npm run seed:master
npm run simulate:tracking
```

## 3) Login and save JWT token (PowerShell)

```powershell
$BASE="http://localhost:5000/api/v1"
$loginBody = @{ username="hqadmin"; password="hqadmin123" } | ConvertTo-Json
$login = Invoke-RestMethod -Method POST -Uri "$BASE/auth/login" -ContentType "application/json" -Body $loginBody
$TOKEN = $login.token
$HEADERS = @{ Authorization = "Bearer $TOKEN" }
```

## 4) Quick endpoint test flow with real IDs

### 4.1 Create province

```powershell
$provinceBody = @{ name="Demo Province"; code="DP" } | ConvertTo-Json
$province = Invoke-RestMethod -Method POST -Uri "$BASE/province" -Headers $HEADERS -ContentType "application/json" -Body $provinceBody
$PROVINCE_ID = $province._id
```

### 4.2 Create district

```powershell
$districtBody = @{ name="Demo District"; code="DD"; province=$PROVINCE_ID } | ConvertTo-Json
$district = Invoke-RestMethod -Method POST -Uri "$BASE/district" -Headers $HEADERS -ContentType "application/json" -Body $districtBody
$DISTRICT_ID = $district._id
```

### 4.3 Create police station

```powershell
$stationBody = @{ name="Demo Station"; code="DD-PS"; district=$DISTRICT_ID } | ConvertTo-Json
$station = Invoke-RestMethod -Method POST -Uri "$BASE/police-station" -Headers $HEADERS -ContentType "application/json" -Body $stationBody
$STATION_ID = $station._id
```

### 4.4 Create tuk

```powershell
$tukBody = @{
  registrationNumber = "WP-9090"
  deviceId = "device-9090"
  ownerName = "Demo Owner"
  district = $DISTRICT_ID
  policeStation = $STATION_ID
} | ConvertTo-Json

$tuk = Invoke-RestMethod -Method POST -Uri "$BASE/tuk" -Headers $HEADERS -ContentType "application/json" -Body $tukBody
$TUK_ID = $tuk._id
```

### 4.5 Create location ping

```powershell
$pingBody = @{
  tuk = $TUK_ID
  latitude = 6.9271
  longitude = 79.8612
  pingedAt = (Get-Date).ToUniversalTime().ToString("o")
  speedKmh = 32.5
  heading = 145
  source = "device"
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri "$BASE/location-ping" -Headers $HEADERS -ContentType "application/json" -Body $pingBody
```

### 4.6 Read endpoints

```powershell
Invoke-RestMethod -Method GET -Uri "$BASE/province" -Headers $HEADERS
Invoke-RestMethod -Method GET -Uri "$BASE/district?provinceId=$PROVINCE_ID" -Headers $HEADERS
Invoke-RestMethod -Method GET -Uri "$BASE/police-station?districtId=$DISTRICT_ID" -Headers $HEADERS
Invoke-RestMethod -Method GET -Uri "$BASE/tuk?districtId=$DISTRICT_ID" -Headers $HEADERS
Invoke-RestMethod -Method GET -Uri "$BASE/tuk/$TUK_ID/last-location" -Headers $HEADERS
```

Time window query:

```powershell
$from = (Get-Date).AddHours(-1).ToUniversalTime().ToString("o")
Invoke-RestMethod -Method GET -Uri "$BASE/location-ping?tukId=$TUK_ID&from=$([System.Web.HttpUtility]::UrlEncode($from))" -Headers $HEADERS
```

## 5) Swagger testing steps

1. Open `http://localhost:5000/api-docs`
2. Call `POST /auth/login`
3. Copy the `token` value
4. Click **Authorize**
5. Enter `Bearer <token>`
6. Use **Try it out** on endpoints

## 6) cURL basics on Windows

PowerShell aliases `curl` to `Invoke-WebRequest`. For real cURL behavior, use `curl.exe`.

### cURL format

```powershell
curl.exe -X METHOD "URL" ^
  -H "Header-Name: value" ^
  -d "{json-body}"
```

Notes:

- `-X` = HTTP method (`GET`, `POST`, `PUT`, `DELETE`)
- `-H` = header (can repeat)
- `-d` = request body
- `-i` = include response headers
- `-s` = silent mode

### Login with cURL

```powershell
curl.exe -X POST "http://localhost:5000/api/v1/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"hqadmin\",\"password\":\"hqadmin123\"}"
```

### Authenticated request with cURL

```powershell
curl.exe -X GET "http://localhost:5000/api/v1/province" -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 7) If token fails

- Ensure `.env` has `JWT_SECRET`
- Restart server after changing `.env`
- Login again and use new token
