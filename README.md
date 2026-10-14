# TrackSphere

**AI-Based Asset Management System with RFID Simulation, Edge Agent Demo & Rule-Based Analytics**

TrackSphere is a college-level full-stack prototype for centralized physical asset management. It demonstrates inventory tracking, simulated RFID scans, edge-agent monitoring, lifecycle workflows (allocation, transfer, retirement, approvals), and transparent rule-based analytics through a web dashboard.

> **Scope:** Student prototype for local demo — not a production enterprise product.  
> RFID, edge agents, and “AI analytics” are **simulated / rule-based**. No real IoT hardware or trained ML model is included.

**Live repo:** [https://github.com/Sudesh-J/TrackSphere](https://github.com/Sudesh-J/TrackSphere)

---

## Table of contents

1. [Problem statement](#problem-statement)
2. [Tech stack](#tech-stack)
3. [System architecture](#system-architecture)
4. [Module overview](#module-overview)
5. [Data model](#data-model)
6. [How it works (flows)](#how-it-works-flows)
7. [API reference](#api-reference)
8. [Getting started](#getting-started)
9. [Demo credentials](#demo-credentials)
10. [Project structure](#project-structure)
11. [What is real vs simulated](#what-is-real-vs-simulated)
12. [Future improvements](#future-improvements)

---

## Problem statement

Organizations manage laptops, IT equipment, and other physical assets across locations. Manual registers and periodic audits make it hard to keep inventory accurate, track movement, find missing items, and monitor utilization.

TrackSphere demonstrates:

- Centralized asset inventory
- Simulated RFID scan → event history
- Basic edge-agent status (seeded demo data)
- Lifecycle: allocate → transfer (with approval) → retire
- Dashboard counts and simple analytics rules

---

## Tech stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + Vite + JavaScript | SPA dashboard & forms |
| Routing | react-router-dom | Login + protected pages |
| Backend | Node.js + Express | REST API |
| Auth | jsonwebtoken + bcryptjs | Login JWT + password hashing |
| Database | PostgreSQL 16 (Docker) | Persistent storage |
| DB driver | `pg` (node-postgres) | Parameterized SQL (no ORM) |
| Config | dotenv | Local secrets via `.env` |
| Orchestration | Docker Compose | Local Postgres + volume |

**Not used (by design):** TypeScript, ASP.NET, microservices, ORM.

---

## System architecture

```text
┌─────────────────────┐     HTTPS/JSON + JWT      ┌─────────────────────┐
│  React + Vite UI    │ ─────────────────────────► │  Express REST API   │
│  localhost:5173     │ ◄───────────────────────── │  localhost:4000     │
│                     │                            │                     │
│  • Login            │                            │  • Auth middleware  │
│  • Dashboard        │                            │  • Route modules    │
│  • Inventory        │                            │  • Validation       │
│  • Lifecycle pages  │                            │                     │
│  • RFID / Agents    │                            └──────────┬──────────┘
│  • Analytics        │                                       │
└─────────────────────┘                                       │ SQL (pg)
                                                              ▼
                                                   ┌─────────────────────┐
                                                   │  PostgreSQL 16      │
                                                   │  Docker :5433       │
                                                   │  volume: pgdata     │
                                                   └─────────────────────┘
```

### High-level flow

1. User opens the React app and signs in.
2. Backend verifies email/password (bcrypt) and returns a **JWT**.
3. Frontend stores the token in **React memory** and sends `Authorization: Bearer <token>` on API calls.
4. Express `requireAuth` middleware validates the JWT.
5. Handlers run **parameterized SQL** against PostgreSQL and return JSON.
6. UI updates tables, badges, and dashboards.

---

## Module overview

### Frontend (`frontend/`)

| Module | Responsibility |
|--------|----------------|
| `src/auth.jsx` | Auth context: login, logout, JWT in memory |
| `src/api.js` | Shared `fetch` helper to Express |
| `src/components/Layout.jsx` | Sidebar shell + navigation |
| `src/components/StatusBadge.jsx` | Status chips |
| `src/pages/Login.jsx` | Sign-in form |
| `src/pages/Dashboard.jsx` | Totals, categories, recent events |
| `src/pages/Assets.jsx` | List / search / create / update assets |
| `src/pages/Allocations.jsx` | Assign asset to person / return |
| `src/pages/Transfers.jsx` | Request location transfer |
| `src/pages/Retirements.jsx` | Request scrap / sale / donate |
| `src/pages/Approvals.jsx` | Approve / reject pending items |
| `src/pages/RfidScan.jsx` | Simulated RFID scan form |
| `src/pages/Agents.jsx` | Seeded edge-agent status |
| `src/pages/Analytics.jsx` | Rule-based stale / missing views |

### Backend (`backend/`)

| Module | Responsibility |
|--------|----------------|
| `src/index.js` | App bootstrap, CORS, route mounting, health |
| `src/db/pool.js` | PostgreSQL pool + `query()` helper |
| `src/middleware/auth.js` | JWT verification (`requireAuth`) |
| `src/routes/auth.js` | Login |
| `src/routes/assets.js` | Asset CRUD + search/filter |
| `src/routes/tracking.js` | RFID simulation scan + events |
| `src/routes/dashboard.js` | Summary counts for home page |
| `src/routes/allocations.js` | Allocate / return |
| `src/routes/transfers.js` | Transfer request / approve / reject |
| `src/routes/retirements.js` | Retirement request / approve / reject |
| `src/routes/approvals.js` | Unified pending inbox |
| `src/routes/agents.js` | Edge-agent demo data |
| `src/routes/analytics.js` | Rule-based analytics |

### Database (`database/`)

| File | Purpose |
|------|---------|
| `init.sql` | Schema + seed data (runs on first container create) |
| `migrate_3_5.sql` | Adds lifecycle tables to an already-created DB |

---

## Data model

| Table | Purpose |
|-------|---------|
| `users` | Demo login account (bcrypt password hash) |
| `assets` | Inventory master (code, RFID, location, status, last scanned) |
| `tracking_events` | Scan history from RFID simulation |
| `edge_agents` | Seeded agent id / status / heartbeat |
| `allocations` | Asset assigned to a person (`allocated` / `returned`) |
| `transfers` | Location move requests (`pending` / `approved` / `rejected`) |
| `retirements` | End-of-life requests (`pending` / `retired` / `rejected`) |

**Asset statuses:** `available`, `in_use`, `maintenance`, `missing`, `retired`

---

## How it works (flows)

### 1) Authentication

```text
Login form → POST /api/auth/login
  → lookup user by email
  → bcrypt.compare(password, hash)
  → jwt.sign(...) → return token
Protected page → API call with Bearer token
  → requireAuth verifies JWT → continue or 401
```

### 2) Asset inventory

- List with optional `search` and `status` query params
- Create / update with validation and unique `asset_code` / `rfid_tag_id`

### 3) RFID simulation

```text
Scan form (tag ID) → POST /api/tracking/scan
  → find asset by rfid_tag_id
  → insert tracking_events
  → update assets.last_scanned_at (+ optional location)
  → return matched asset (labeled as simulation)
```

### 4) Allocation

```text
Allocate → status allocated, asset → in_use
Return   → status returned, asset → available
```

### 5) Transfer + approval

```text
Request transfer → pending
Approvals inbox lists pending transfers & retirements
Approve → transfer approved, asset.location = to_location
Reject  → transfer rejected, location unchanged
```

### 6) Retirement + approval

```text
Request retirement (scrap/sale/donate) → pending
Approve → retirement retired, asset → retired
Reject  → retirement rejected
```

### 7) Analytics (prototype)

Rule example: assets not scanned within **N days** (default 7) are flagged **stale**. Also groups by status/category and counts missing assets. Explicitly **not** a trained AI model.

---

## API reference

Base URL: `http://localhost:4000`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health + DB check |
| POST | `/api/auth/login` | No | Issue JWT |
| GET/POST | `/api/assets` | Yes | List / create |
| GET/PUT | `/api/assets/:id` | Yes | Read / update |
| POST | `/api/tracking/scan` | Yes | Simulated RFID scan |
| GET | `/api/tracking/events` | Yes | Recent events |
| GET | `/api/dashboard/summary` | Yes | Dashboard data |
| GET/POST | `/api/allocations` | Yes | List / allocate |
| POST | `/api/allocations/:id/return` | Yes | Return asset |
| GET/POST | `/api/transfers` | Yes | List / request |
| POST | `/api/transfers/:id/approve` | Yes | Approve transfer |
| POST | `/api/transfers/:id/reject` | Yes | Reject transfer |
| GET/POST | `/api/retirements` | Yes | List / request |
| POST | `/api/retirements/:id/approve` | Yes | Approve retirement |
| POST | `/api/retirements/:id/reject` | Yes | Reject retirement |
| GET | `/api/approvals/pending` | Yes | Unified inbox |
| GET | `/api/agents` | Yes | Edge agents (demo) |
| GET | `/api/analytics/overview` | Yes | Rule-based analytics |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm  
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running  

### 1) Clone

```bash
git clone https://github.com/Sudesh-J/TrackSphere.git
cd TrackSphere
```

### 2) Start PostgreSQL

```bash
docker compose up -d
```

Postgres is exposed on host port **5433** (avoids clashing with other local Postgres instances).

If this database volume was created before lifecycle tables existed:

```powershell
Get-Content database\migrate_3_5.sql | docker exec -i tracksphere-db psql -U tracksphere -d tracksphere
```

### 3) Backend

```bash
cd backend
cp .env.example .env          # Windows: copy .env.example .env
npm install
npm run dev
```

API: http://localhost:4000 — health: http://localhost:4000/api/health

### 4) Frontend

```bash
cd frontend
cp .env.example .env          # Windows: copy .env.example .env
npm install
npm run dev
```

UI: http://localhost:5173

### Stop

- Stop API / frontend with `Ctrl+C`
- Stop DB: `docker compose down`  
- Reset DB data: `docker compose down -v` (deletes volume)

---

## Demo credentials

| Field | Value |
|-------|-------|
| Email | `admin@tracksphere.demo` |
| Password | `Demo@123` |
| Sample RFID tags | `RFID-TAG-1001` … `RFID-TAG-1008` |

---

## Project structure

```text
TrackSphere/
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api.js
│   │   ├── auth.jsx
│   │   └── styles.css
│   ├── .env.example
│   └── package.json
├── backend/                  # Express API
│   ├── src/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── index.js
│   ├── .env.example
│   └── package.json
├── database/
│   ├── init.sql              # Schema + seed
│   └── migrate_3_5.sql       # Lifecycle migration
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## What is real vs simulated

| Feature | Status |
|---------|--------|
| Login, JWT, bcrypt | Real (local demo) |
| Asset CRUD + PostgreSQL | Real |
| Allocation / transfer / retirement / approvals | Real workflow logic |
| RFID scanning | **Simulated** (form + API, no hardware) |
| Edge agents | **Simulated** (seeded rows) |
| AI analytics | **Prototype rules** (not a trained model) |

---

## Future improvements

- Persist JWT in `sessionStorage` for refresh-friendly demos  
- Role-based access (requester vs approver)  
- Pagination, sorting, and richer UI validation  
- Audit log of who changed what  
- Charts on the analytics page  
- Automated tests + CI  
- Soft-delete / deactivate assets  

---

## License / academic note

Built as an academic PBL prototype. Sample data is fictional. Do not commit real secrets — use `.env` locally (see `.env.example` files).
