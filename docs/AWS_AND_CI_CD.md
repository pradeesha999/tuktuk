# AWS hosting and GitHub CI/CD (merge to `main` → deploy)

This document matches what is in `.github/workflows/`: **CI on every push/PR**, and **deploy on push to `main`** (after lint + tests).

## Big picture

1. Your API runs on a server (AWS) with Node.js.
2. MongoDB stays on **MongoDB Atlas** (recommended). The server only needs `MONGO_URI` and `JWT_SECRET` in a `.env` file (or environment variables).
3. **GitHub Actions** runs when you push: it lints, tests, then (on `main` only) SSHs into the server, `git pull`, `npm ci`, `pm2 restart`.

You do **not** have to use AWS if the brief allows another host, but the steps below assume **one small EC2 instance** (simple and common for coursework).

---

## Part A — Git branching (what you do locally)

1. Finish work on `dev`.
2. Commit and push `dev` to GitHub.
3. Open a Pull Request: `dev` → `main`.
4. Merge when CI is green.
5. Merging to `main` triggers **Deploy production** (if GitHub secrets are set).

---

## Part B — AWS: create the server (EC2)

1. AWS Console → **EC2** → **Launch instance**.
2. OS: **Ubuntu Server 22.04 LTS** (or 24.04).
3. Instance type: **t3.micro** or **t2.micro** (free tier eligible if your account qualifies).
4. Key pair: create or select one; download the `.pem` file (you need it for SSH and for GitHub Actions).
5. Security group inbound rules:
   - **22** from your IP (SSH).
   - **80** and/or **443** if you put Nginx in front later (optional for coursework).
   - **5000** (or whichever `PORT` you use) from **0.0.0.0/0** only for a quick demo — for real use, restrict by IP or use Nginx + HTTPS.
6. Launch instance. Note the **public IPv4 address** → this is `EC2_HOST` for GitHub secrets.

---

## Part C — Prepare the EC2 instance (one-time)

SSH from your PC (PowerShell example; replace path and user):

```powershell
ssh -i "C:\path\to\your-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

On the server:

```bash
sudo apt update && sudo apt install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Clone your repo (use your real GitHub URL):

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/YOUR_USER/YOUR_REPO.git webapi
cd webapi
git checkout main
```

Create `.env` on the server (never commit this file):

```env
PORT=5000
MONGO_URI=your_atlas_connection_string
JWT_SECRET=your_long_random_secret
```

Install and start:

```bash
npm ci --omit=dev
pm2 start server.js --name webapi
pm2 save
pm2 startup
```

Check:

```bash
curl -s http://127.0.0.1:5000/api-docs | head
```

Swagger UI is at `http://YOUR_EC2_IP:5000/api-docs` if port 5000 is open in the security group.

---

## Part D — GitHub Actions secrets (required for CI + deploy)

GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret name | Purpose |
|-------------|---------|
| `TEST_MONGO_URI` | Optional. If unset, CI tests use **MongoDB Memory Server** (no Atlas needed). Set this if you want CI to hit a real Atlas database instead. |
| `EC2_HOST` | EC2 public IP or DNS, e.g. `3.120.45.67` |
| `EC2_USER` | Usually `ubuntu` on Ubuntu AMIs |
| `EC2_SSH_KEY` | Full private key text (the `.pem` contents), including `BEGIN` / `END` lines |
| `EC2_APP_DIR` | App path on server, e.g. `/var/www/webapi` |
| `PM2_APP_NAME` | e.g. `webapi` (must match what you used in `pm2 start`) |

**CI note:** `.github/workflows/ci.yml` runs `npm test`, which needs `TEST_MONGO_URI` (or a Mongo URI in secrets). Without it, CI fails on GitHub.

---

## Part E — What the workflows do

- **`ci.yml`**: on push/PR to `main` or `dev` → `npm ci` → `npm run lint:ci` → `npm test`.
- **`deploy-production.yml`**: on push to `main` only → same checks, then SSH to EC2 → `git pull` → `npm ci --omit=dev` → `pm2 restart` (or first-time `pm2 start`).

If deploy fails, read the **Actions** tab log; usual causes: wrong `EC2_APP_DIR`, key permissions, branch not `main` on server, or firewall.

---

## Part F — AWS alternatives (same CI idea)

- **AWS Elastic Beanstalk**: upload a version or use EB CLI; GitHub Action can call `eb deploy` with AWS credentials.
- **AWS App Runner**: build from a **Dockerfile** in the repo; GitHub pushes an image or App Runner watches the repo (less “SSH pull” style).
- **ECS Fargate**: more moving parts; better for teams, not always worth it for a small coursework API.

For “automatic on merge to main,” **EC2 + PM2 + SSH deploy** is the most straightforward to explain in a report.

---

## Part G — Checklist before demo

- [ ] Atlas IP allowlist includes EC2 outbound IP (or `0.0.0.0/0` for demo only if policy allows).
- [ ] `.env` on server has `MONGO_URI` and `JWT_SECRET`.
- [ ] `main` branch contains the latest code; `deploy-production` has run successfully once.
- [ ] Report appendix lists: public API base URL, Swagger URL (`/api-docs`), GitHub repo URL.
