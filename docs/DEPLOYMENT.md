# TrackSphere — EC2 + Cloudflare deployment guide

This guide prepares TrackSphere for cloud deployment. **Do not** create paid resources or publish from this document alone — it is readiness documentation only.

---

## GitHub Actions → EC2 deploy pipeline

Workflow file: `.github/workflows/deploy-ec2.yml`  
Triggers: push to `main`, or **Actions → Deploy to EC2 → Run workflow**.

### GitHub secrets to add

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Required | Example / notes |
|--------|----------|-----------------|
| `EC2_HOST` | Yes | EC2 public IP or DNS, e.g. `3.110.x.x` |
| `EC2_USER` | Yes | Usually `ubuntu` (Ubuntu AMI) or `ec2-user` (Amazon Linux) |
| `EC2_SSH_KEY` | Yes | Full private key PEM contents (`-----BEGIN ... PRIVATE KEY-----`) |
| `EC2_PORT` | No | SSH port; defaults to `22` |
| `DEPLOY_PATH` | No | App directory on server; defaults to `/opt/tracksphere` |

Never commit the PEM file or put the IP in the workflow YAML.

### One-time EC2 bootstrap (do this once manually)

1. Launch an Ubuntu EC2 instance; open security group ports **22** (your IP), **80/443** (public or Cloudflare).
2. SSH in and install Docker:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-v2
sudo usermod -aG docker $USER
# log out/in so docker works without sudo
```

3. Clone the repo (use a deploy key or HTTPS):

```bash
sudo mkdir -p /opt/tracksphere
sudo chown $USER:$USER /opt/tracksphere
git clone https://github.com/Sudesh-J/TrackSphere.git /opt/tracksphere
cd /opt/tracksphere
```

4. Create production env (edit values):

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Set at least:

- `JWT_SECRET` (long random string)
- `DATABASE_URL=postgresql://tracksphere:YOUR_DB_PASSWORD@db:5432/tracksphere`
- `APP_PUBLIC_URL=https://your.domain` (or `http://EC2_IP:5173` for a quick demo)
- `GEMINI_API_KEY` / `AGENT_TOKEN` as needed

Also create `/opt/tracksphere/.env` for Compose (DB password must match):

```bash
cat > .env <<'EOF'
POSTGRES_USER=tracksphere
POSTGRES_PASSWORD=YOUR_DB_PASSWORD
POSTGRES_DB=tracksphere
DATABASE_URL=postgresql://tracksphere:YOUR_DB_PASSWORD@db:5432/tracksphere
VITE_API_URL=http://YOUR_EC2_IP:4000
EOF
```

5. First manual deploy:

```bash
chmod +x scripts/remote-deploy.sh
./scripts/remote-deploy.sh
```

6. Add the GitHub secrets above, then push to `main` (or run the workflow manually).

### What the pipeline does

1. SSHs into the EC2 instance using `EC2_HOST` / `EC2_USER` / `EC2_SSH_KEY`
2. `git pull` on `DEPLOY_PATH` (default `/opt/tracksphere`)
3. Runs `scripts/remote-deploy.sh` → `docker compose -f docker-compose.prod.yml up -d --build`
4. Applies idempotent SQL migrations
5. Hits `http://127.0.0.1:4000/api/health`

### Notes

- The EC2 machine must already exist; the workflow does **not** create AWS infrastructure.
- Put Nginx/Cloudflare in front for HTTPS before a public demo (see below).
- For `VITE_API_URL`, use the URL browsers will call (public API URL). Rebuild frontend after changing it (`remote-deploy.sh` rebuilds images).

## Architecture on a single EC2 host

- Nginx (or Caddy) terminates HTTPS and proxies:
  - `/` → frontend static build (or Vite preview / Node static server)
  - `/api` → Express backend (`127.0.0.1:4000`)
- PostgreSQL listens on **localhost only** (do not expose 5432/5433 publicly)
- Uploads volume mounted for asset photos
- Cloudflare DNS + proxy for the public hostname

## Environment variables (production)

Set on the backend host (never commit real values):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Private Postgres connection string |
| `JWT_SECRET` | Long random secret |
| `JWT_EXPIRES_IN` | e.g. `8h` |
| `APP_PUBLIC_URL` | `https://your.domain` (embedded in QR codes) |
| `GEMINI_API_KEY` | Optional — invoice + assistant |
| `AGENT_TOKEN` | Shared secret for laptop health agent |
| `PORT` | Usually `4000` behind reverse proxy |

Frontend build:

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | `https://your.domain` (same origin preferred) or API URL |

## Restricted server access

- Security group: allow **22** only from your IP; **80/443** from Cloudflare or world
- Deny public access to Postgres ports
- Prefer SSH keys; disable password auth
- Keep OS packages updated

## Cloudflare

1. Add DNS `A`/`AAAA` for the domain → EC2 public IP  
2. Proxy status: Proxied (orange cloud) for HTTP(S)  
3. SSL/TLS mode: **Full (strict)** once origin has a valid cert (Let’s Encrypt)  
4. Optional: WAF rate limits on `/api/auth/login`

## HTTPS

- Obtain a certificate on the origin (Certbot + Nginx) **or** use Cloudflare Origin Certificate  
- Redirect HTTP → HTTPS  
- Set `APP_PUBLIC_URL` to the HTTPS URL so QR codes work on phones

## PostgreSQL privacy & backups

- Bind Postgres to `127.0.0.1`  
- Nightly backup example:

```bash
pg_dump -U tracksphere tracksphere | gzip > /var/backups/tracksphere-$(date +%F).sql.gz
```

- Store backups off-box (S3, another volume) and test restore periodically  
- Docker named volume `tracksphere_pgdata` should be snapshotted if using Compose on the host

## Deploy steps (outline)

1. Install Docker or Node 20 + Postgres 16 on EC2  
2. Clone repo; copy `.env.example` → `.env` with production secrets  
3. Run migrations: `migrate_3_5.sql` (if needed) then `migrate_4_0.sql`  
4. `npm install` + `npm run build` in `frontend`; serve `dist/`  
5. Run backend with process manager (systemd / pm2)  
6. Configure Nginx reverse proxy + TLS  
7. Point Cloudflare DNS; verify login, QR handover, and photo upload  

## Health agent in the field

- Install Node on Windows laptops  
- Set `API_URL=https://your.domain`, `AGENT_TOKEN=...`  
- Run `npm start` in `agent/` (Task Scheduler for persistence)

## Known cloud limitations

- Gemini usage incurs provider cost/quota  
- Camera QR scan requires HTTPS (browser getUserMedia)  
- This guide does not provision AWS or Cloudflare resources automatically
