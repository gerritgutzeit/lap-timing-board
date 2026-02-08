<p align="center">
  <strong>Race Timing Dashboard</strong>
</p>

<p align="center">
  Live timing board for F1, karting, or any track — dark UI, admin backend, Docker-ready.
</p>

<details open>
<summary><b>📸 Screenshots</b></summary>

<p align="center">
  <img src="assets/image1.jpg" alt="Dashboard" width="32%" />
  <img src="assets/image2.jpg" alt="Admin panel" width="32%" />
  <img src="assets/image3.jpg" alt="Fullscreen view" width="32%" />
</p>

<p align="center">
  <sub><b>Dashboard</b></sub> &nbsp;·&nbsp; <sub><b>Admin</b></sub> &nbsp;·&nbsp; <sub><b>Fullscreen</b></sub>
</p>

</details>

---

## Contents

- [Tech stack](#tech-stack)
- [Features](#features)
- [Quick start](#quick-start)
- [Development](#development)
- [API](#api)
- [Production & deployment](#production--deployment)
- [Project structure](#project-structure)
- [License](#license)

---

## Tech stack

| Layer    | Stack |
| -------- | ----- |
| **Frontend** | Next.js (App Router), React, TailwindCSS, TypeScript |
| **Backend**  | Node.js, Express |
| **Database** | SQLite via [sql.js](https://sql.js.org/) (no native build) |
| **API**      | REST (tracks, laps, config) |

---

## Features

- **Dashboard** — Multi-track or single-track fullscreen, fastest laps, auto-refresh (5s), optional track outline per track
- **Admin** — Headline & status, dashboard track selection, track outline upload (PNG), tracks & lap times (format `m:ss.xxx`), driver management
- **Deploy** — Docker Compose or Portainer (Git or pre-built images)

---

## Quick start

**Prerequisites:** Node.js 18+, npm

```bash
git clone <your-repo-url>
cd Formel1Dash
```

**Backend**

```bash
cd backend && npm install && npm run dev
```

**Frontend** (new terminal)

```bash
cd frontend && npm install && npm run dev
```

- **App:** [http://localhost:3000](http://localhost:3000)  
- **API:** [http://localhost:3001](http://localhost:3001)

The SQLite DB and tables are created on first run. To init explicitly: `cd backend && npm run db:init`.

---

## Development

1. Open **http://localhost:3000** → **Admin** to add tracks and lap times.
2. Open **http://localhost:3000/dashboard** for the live timing board (select tracks in Admin → Dashboard track selection).

---

## API

| Method | Endpoint | Description |
| :----: | -------- | ----------- |
| GET | `/api/tracks` | List tracks |
| GET | `/api/tracks/:id` | Get one track |
| POST | `/api/tracks` | Create track `{ name, country }` |
| DELETE | `/api/tracks/:id` | Delete track |
| GET | `/api/laps` | List laps (optional `?track_id=`) |
| GET | `/api/laps/track/:trackId` | Fastest laps for track |
| POST | `/api/laps` | Create lap `{ driver_name, lap_time, track_id }` |
| DELETE | `/api/laps/:id` | Delete lap |

---

## Production & deployment

### Local production build

```bash
# Backend
cd backend && npm start

# Frontend (set NEXT_PUBLIC_API_URL to your API URL first)
cd frontend && npm run build && npm start
```

### Docker (one command)

From project root:

```bash
docker-compose up --build -d
```

- **Frontend:** http://localhost:3000  
- **Backend:** http://localhost:3001  
- Data (DB + uploads) is stored in Docker volumes.

The frontend uses the **browser’s host** for the API when you don’t set `NEXT_PUBLIC_API_URL`, so the same image works when you open the app from another machine (e.g. `http://server-ip:3000` → API: `http://server-ip:3001/api`). To force a specific URL (e.g. for a reverse proxy), set before building:

```bash
NEXT_PUBLIC_API_URL=http://myserver:3001/api
```

**How to check that the API URL is correct**

1. Open the app from the machine you care about (same PC or another on the network).
2. Open DevTools (F12) → **Network** tab.
3. Use the app (e.g. open Admin, load tracks or save something).
4. Click any request to your API (e.g. `tracks`, `config/...`). The request URL should use the **same host** as the page (e.g. `http://192.168.1.50:3001/api/...` when you opened `http://192.168.1.50:3000`). If you see `http://localhost:3001/...` while the page is `http://server-ip:3000`, rebuild the frontend without setting `NEXT_PUBLIC_API_URL` and redeploy.
5. In **Admin**, the header shows **API: http://…** — that should match the host you used to open the page (e.g. `http://192.168.1.50:3001` when you opened `http://192.168.1.50:3000`).

### Portainer

| Scenario | What to do |
| -------- | ---------- |
| **Standalone (build allowed)** | Stacks → Add stack → **Git repository** → repo URL, Compose path: `docker-compose.yml` → Deploy. Optionally set `NEXT_PUBLIC_API_URL`. |
| **Swarm / no build** | Build and push images locally (see below), then Stacks → **Web editor** → paste `docker-compose.portainer.yml` → set env `REGISTRY=YOUR_DOCKERHUB_USER` → Deploy. |

**Build and push for Portainer (when build is disabled):**

```bash
docker-compose build
docker tag formel1dash-backend:latest YOUR_USER/formel1dash-backend:latest
docker tag formel1dash-frontend:latest YOUR_USER/formel1dash-frontend:latest
docker push YOUR_USER/formel1dash-backend:latest
docker push YOUR_USER/formel1dash-frontend:latest
```

If the app is used from another host, rebuild the frontend with the correct API URL:

```bash
NEXT_PUBLIC_API_URL=http://YOUR_SERVER:3001/api docker-compose build frontend
# then tag and push formel1dash-frontend:latest as above
```

In Portainer, use **Web editor** with `docker-compose.portainer.yml` and set `REGISTRY` to your Docker Hub username (or e.g. `ghcr.io/YOUR_USER`).

---

## Project structure

```
backend/
  server.js, database.js    # App & SQLite
  routes/, controllers/     # API
  scripts/initDb.js         # DB init

frontend/
  app/                      # Next.js App Router (dashboard, admin)
  lib/api.ts                # API client
  components/               # CountryFlag, TrackOutline, etc.
```

---

## License

MIT
