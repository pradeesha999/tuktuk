# P1 Runbook: Transport Security and Secret Hygiene

This runbook implements P1 from `docs/SECURITY_IMPLEMENTATION_PLAN.md`.
It focuses on HTTPS, JWT secret hardening, and secret rotation.

---

## Scope of this runbook

- Enforce HTTPS in front of the API on EC2.
- Remove insecure secret fallbacks in app code.
- Rotate secrets safely.
- Verify behavior with simple commands.

---

## 1) Code-side hardening (done in repository)

- Required env vars enforced at startup: `MONGO_URI`, `JWT_SECRET`.
- JWT secret fallback (`"change-this-secret"`) removed.

If `JWT_SECRET` is missing, app startup now fails fast.

---

## 2) EC2 HTTPS setup (Nginx reverse proxy + Let's Encrypt)

> Prerequisite: a domain name pointing to your EC2 public IP.

### Install Nginx + Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Nginx site config

Create `/etc/nginx/sites-available/webapi`:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/webapi /etc/nginx/sites-enabled/webapi
sudo nginx -t
sudo systemctl reload nginx
```

### Issue TLS cert and enable HTTPS redirect

```bash
sudo certbot --nginx -d api.your-domain.com --redirect -m your-email@example.com --agree-tos -n
```

This configures:

- TLS certificate
- automatic HTTP -> HTTPS redirect

---

## 3) Tighten security groups

- Keep `22` open only to your own IP.
- Open `80` and `443` for public access.
- Close public `5000` once Nginx proxy is working.

---

## 4) Secret rotation procedure (JWT + Mongo)

### Rotate JWT secret

1. Generate a new long random JWT secret.
2. Update `JWT_SECRET` in EC2 `.env`.
3. Restart app:

```bash
pm2 restart webapi
```

4. Existing JWTs become invalid (expected); users must log in again.

### Rotate Mongo credentials

1. Create new DB user/password in Atlas.
2. Update `MONGO_URI` on server.
3. Restart PM2 app.
4. Remove old DB user after verification.

---

## 5) Verification checklist

### HTTPS

```bash
curl -I http://api.your-domain.com
```

Expected: `301`/`308` redirect to `https://...`

```bash
curl -I https://api.your-domain.com/api-docs
```

Expected: `200` (or auth-related response depending on path)

### App env enforcement

Temporarily remove `JWT_SECRET` and restart (test only):

```bash
pm2 restart webapi
pm2 logs webapi --lines 50
```

Expected: startup failure with missing env error.

Restore `.env` immediately after this check.

---

## 6) Evidence to capture for report

- Screenshot of HTTPS lock icon and `/api-docs` over `https://`.
- Terminal output showing HTTP -> HTTPS redirect.
- Snippet of PM2 restart after secret update.
- Short note: JWT rotation invalidates old tokens by design.

