# GitHub Actions secrets — checklist (copy your values below)

Add these in GitHub: **Repository → Settings → Secrets and variables → Actions → New repository secret**.

Use one secret per row. **Never commit real values** to git; this file is only for your private notes (optional: keep a copy outside the repo).

---

## Values to paste into GitHub

| Secret name        | Your value (paste here for your notes only) |
|--------------------|-----------------------------------------------|
| `TEST_MONGO_URI`   | Atlas-style URI for `npm test` in CI (like `MONGO_URI` in `.env.example`). Prefer a separate DB name (e.g. `webapi_test`) on the same cluster if you want isolation. **Alternatively**, add a repository secret named `MONGO_URI` with the same value — workflows use `TEST_MONGO_URI` first, then fall back to `MONGO_URI`. |
| `EC2_HOST`         | `13.63.49.231` (public IPv4 for this project’s EC2; matches `docs/AWS_AND_CI_CD.md`) |
| `EC2_USER`         | `ubuntu` |
| `EC2_SSH_KEY`      | Full private key text from your `.pem` (e.g. local file `Webserver-api.pem` — paste **contents only** into GitHub, never commit the file). Must include `BEGIN` / `END` lines. |
| `EC2_APP_DIR`      | **`/var/www/tuktuk`** on your EC2 (run `pwd` in the folder where you `git pull` — it must match this secret **exactly**). If this is wrong, Actions SSH can succeed but update a different folder than PM2 runs from. |
| `PM2_APP_NAME`     | `webapi` (same as `pm2 start server.js --name webapi` in `docs/AWS_AND_CI_CD.md`) |

---

## Quick reference (purpose)

| Secret name       | Purpose |
|-------------------|---------|
| `TEST_MONGO_URI`  | Mongo URL for `npm test` in CI; if unset, workflows use `MONGO_URI` instead. |
| `EC2_HOST`        | Public IPv4 or DNS of the EC2 instance. |
| `EC2_USER`        | SSH login user (Ubuntu AMI → usually `ubuntu`). |
| `EC2_SSH_KEY`     | Private key that matches the key pair on the instance. |
| `EC2_APP_DIR`     | Absolute path on the server where `server.js` and `.git` live. |
| `PM2_APP_NAME`    | PM2 process name to restart after `git pull`. |

---

## `EC2_SSH_KEY` format (important)

Paste the **entire** key, for example:

```
-----BEGIN RSA PRIVATE KEY-----
...multiple lines...
-----END RSA PRIVATE KEY-----
```

or

```
-----BEGIN OPENSSH PRIVATE KEY-----
...multiple lines...
-----END OPENSSH PRIVATE KEY-----
```

No extra spaces at the start of lines. In GitHub, paste as **one multiline secret**.

---

## Why “deployment failed” emails after merge

The workflow **Deploy production** (`.github/workflows/deploy-production.yml`) runs on **every push to `main`**. It will **fail** if, for example:

- Any of `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `EC2_APP_DIR`, or `PM2_APP_NAME` is **missing** or wrong.
- `EC2_APP_DIR` is wrong → `cd` fails or updates the wrong folder (yours should be `/var/www/tuktuk` if that is where you cloned).
- The server cannot `git pull` (no repo, wrong remote, or branch permissions).
- SSH key does not match the instance, or security group blocks port 22 from GitHub’s runners.

**Lint/tests** can pass while **Deploy** still fails — check the **Actions** tab → failed run → expand **Deploy to EC2** for the exact error.

After secrets are correct, re-run the workflow or push an empty commit to `main` to deploy again.

---

## Deploy did not update the VM (common causes)

1. **`EC2_APP_DIR` mismatch** — On the server, `cd` to the directory where PM2 runs `server.js` and run `pwd`. That path must be the same as the `EC2_APP_DIR` secret (your machine uses `/var/www/tuktuk`, not `/var/www/webapi`).

2. **GitHub cannot SSH into EC2** — The security group must allow **inbound TCP 22** from **GitHub Actions runners**, not only from your home IP. Runner IPs change; for coursework many people use **SSH from `0.0.0.0/0`** (tighten later) or a self-hosted runner.

3. **`deploy` job failed** — In GitHub: **Actions** → latest **Deploy production** run → open the **Deploy to EC2** step log. Email notifications are easy to miss; the log is the source of truth.

4. **API works on the server but not from the internet** — Open **inbound TCP 5000** (or your `PORT`) from `0.0.0.0/0` in the EC2 security group. `curl http://127.0.0.1:5000` on the VM only proves the process listens locally.

5. **Listen address** — `server.js` should listen on `0.0.0.0` (already in repo). After `git pull`, run `pm2 restart webapi` once so the running process picks it up.
