# TrackSphere

**Asset management with QR handover, roles, reports/NBV, invoice intake, Gemini assistant, and laptop health agent**

Student / PBL full-stack app: **React + Vite** → **Express** → **PostgreSQL (Docker)**.

Repo: [https://github.com/Sudesh-J/TrackSphere](https://github.com/Sudesh-J/TrackSphere)

> Demo data and credentials below are **fictional / demo-only**.  
> QR handover replaces simulated RFID as the main tracking flow.  
> Gemini features need `GEMINI_API_KEY`. Battery health shows **Unavailable** unless Windows exposes capacity data.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, react-router-dom, html5-qrcode |
| Backend | Node.js, Express, JWT, bcryptjs, multer, qrcode |
| AI (optional) | Google Gemini via `@google/generative-ai` (server-side only) |
| Database | PostgreSQL 16 + SQL migrations |
| Agent | Minimal Windows Node health agent (`agent/`) |

---

## Features implemented

### Auth, roles, activity
- Login with bcrypt + JWT (session restored via `sessionStorage` for QR redirect)
- Roles: **Admin**, **Staff**, **Approver** (enforced in API + UI)
- Activity history for creates/updates, handovers, returns, approvals, retirements, role changes
- Actor identity always from JWT — not from client-supplied names

### Assets, reports, valuation
- Asset register with purchase cost/date, residual value, useful life, vendor, serial, location, category, status, photo
- Straight-line **NBV** (see formula below)
- Reports with filters + **CSV export** + print/PDF via browser
- Separate **NPV calculator** (cash flows + discount rate) — not mixed with NBV

**NBV formula (straight-line):**  
`annualDepreciation = (purchaseCost - residualValue) / usefulLifeYears`  
`accumulated = min(annualDepreciation × yearsElapsed, purchaseCost - residualValue)`  
`NBV = max(purchaseCost - accumulated, residualValue)`  
Years use day-fraction `/ 365.25`. Missing inputs → NBV shown as unavailable (not invented).

### QR handover
- Unique QR per asset → `/handover/:qrToken`
- Phone camera open URL → login if needed → return to handover
- In-app camera scan + manual asset-code fallback
- Assign to searchable employees; confirm draft; return flow
- Blocks handover when status is in_use / missing / maintenance / retired
- DB transactions keep asset + allocation consistent

### Invoice intake + assistant (Gemini)
- Upload PDF/image; backend Gemini suggests fields; editable review; confirm to create asset
- Assistant for find/summarize/explain; drafts require confirmation; respects roles
- Clear message when `GEMINI_API_KEY` missing; manual entry still works

### Laptop health agent
- `agent/` posts CPU, memory, battery (when available) with `AGENT_TOKEN`
- No filenames, process lists, or user activity collection
- UI shows check-ins + threshold/trend **health warnings** (not predictive maintenance)
- Manual **demo telemetry** button clearly labeled

### Responsive + photos
- Mobile-friendly layout, handover, scan, login, reports
- Photo capture/upload; files stored under `backend/uploads` and served only via authenticated API

---

## Demo credentials (demo-only)

| Email | Password | Role |
|-------|----------|------|
| `admin@tracksphere.demo` | `Demo@123` | Admin |
| `staff@tracksphere.demo` | `Demo@123` | Staff |
| `approver@tracksphere.demo` | `Demo@123` | Approver |

**Employees** (recipients, no login): EMP-001 … EMP-005 (Priya Sharma, Aman Verma, …) — fictional.

---

## Local setup

### Prerequisites
- Node.js 18+
- Docker Desktop

### 1) Database

```powershell
cd TrackSphere
docker compose up -d db
```

If the volume already existed before this update, apply migrations:

```powershell
Get-Content database\migrate_3_5.sql | docker exec -i tracksphere-db psql -U tracksphere -d tracksphere
Get-Content database\migrate_4_0.sql | docker exec -i tracksphere-db psql -U tracksphere -d tracksphere
```

### 2) Backend

```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```

Optional in `.env`: `GEMINI_API_KEY`, `AGENT_TOKEN`, `APP_PUBLIC_URL=http://localhost:5173`

### 3) Frontend

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173

### 4) Full stack via Compose (optional)

```powershell
cd TrackSphere
docker compose up
```

### 5) Health agent (optional)

```powershell
cd agent
copy .env.example .env
npm install
npm start
# or: npm run demo
```

---

## Environment variables

See `backend/.env.example`, `frontend/.env.example`, `agent/.env.example`.

Never commit real `.env` files or API keys.

---

## Project structure

```text
TrackSphere/
  frontend/          React app
  backend/           Express API + uploads/
  database/          init.sql, migrate_3_5.sql, migrate_4_0.sql
  agent/             Windows health agent
  docs/DEPLOYMENT.md EC2 + Cloudflare readiness guide
  docker-compose.yml db + backend + frontend
```

---

## Known limitations

- Gemini invoice/assistant require a valid `GEMINI_API_KEY` and network access to Google
- Battery **health %** is often **Unavailable** on Windows unless WMI capacity classes exist
- QR camera scan in browsers generally needs **HTTPS** in production
- RFID simulation endpoints remain only as legacy labeled APIs — UI uses QR handover
- Seeded edge-agent UI removed/deprecated in favor of Device Health
- Not a production multi-tenant SaaS; no claim of live cloud deployment in this repo

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for EC2, Cloudflare DNS/HTTPS, private Postgres, backups, and the **GitHub Actions → EC2** pipeline.

### Quick: GitHub secrets for deploy

| Secret | Purpose |
|--------|---------|
| `EC2_HOST` | Server IP or hostname |
| `EC2_USER` | SSH user (`ubuntu` / `ec2-user`) |
| `EC2_SSH_KEY` | Private SSH key PEM |
| `EC2_PORT` | Optional (default 22) |
| `DEPLOY_PATH` | Optional (default `/opt/tracksphere`) |

Workflow: `.github/workflows/deploy-ec2.yml` (runs on push to `main`). Bootstrap the EC2 host once per the deployment doc before the first pipeline run.
