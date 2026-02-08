# Race Timing Dashboard

![Dashboard screenshot](image1.jpg)

Race Timing Dashboard — professional live timing board for F1, karting, or other racing events, with an admin backend to manage tracks and lap times.

## Tech Stack

- **Frontend:** Next.js (App Router), React, TailwindCSS
- **Backend:** Node.js, Express, SQLite ([sql.js](https://sql.js.org/) — pure JavaScript, no native build or Python required)
- **API:** REST (tracks & laps CRUD, fastest laps per track)

## Features

- **Dashboard:** Track selector, fastest laps per track, auto-refresh every 5 seconds, F1-inspired dark UI
- **Admin:** Create/delete tracks, add/delete lap times (format `mm:ss.xxx`), list all laps

## Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)

## Install

```bash
# Clone and enter project
cd Formel1Dash

# Backend
cd backend
npm install

# Frontend (from project root)
cd ../frontend
npm install
```

## Database setup

The backend creates the SQLite database and tables on first run. To initialize the DB explicitly:

```bash
cd backend
npm run db:init
```

This creates `backend/f1timing.db` and the `tracks` / `laps` tables.

## Run (development)

**Terminal 1 – Backend**

```bash
cd backend
npm run dev
```

API: http://localhost:3001

**Terminal 2 – Frontend**

```bash
cd frontend
npm run dev
```

App: http://localhost:3000

## Dev workflow

1. Start backend and frontend as above.
2. Open http://localhost:3000 → **Admin** to add tracks and lap times.
3. Open http://localhost:3000/dashboard to view the live timing board; select a track and see fastest laps, auto-refreshing every 5s.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tracks` | List all tracks |
| GET | `/api/tracks/:id` | Get one track |
| POST | `/api/tracks` | Create track `{ name, country }` |
| DELETE | `/api/tracks/:id` | Delete track |
| GET | `/api/laps` | List all laps (optional `?track_id=`) |
| GET | `/api/laps/track/:trackId` | Fastest laps for track (ordered by lap_time) |
| POST | `/api/laps` | Create lap `{ driver_name, lap_time, track_id }` |
| DELETE | `/api/laps/:id` | Delete lap |

## Production build

**Backend**

```bash
cd backend
npm start
```

**Frontend**

```bash
cd frontend
npm run build
npm start
```

Set `NEXT_PUBLIC_API_URL` to your backend URL (e.g. `https://api.example.com`) when building the frontend for production.

## Deploy with Docker (easy setup)

From the project root:

```bash
docker-compose up --build -d
```

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:3001  

Database and track outline uploads are stored in Docker volumes, so data survives restarts.

**Deploying on a server (e.g. VPS):**  
The frontend is built with the API URL that the *browser* will use. For same-machine Docker the default `http://localhost:3001/api` is fine. If users reach the app at a different host (e.g. `http://192.168.1.100:3000`), create a `.env` in the project root and set:

```bash
NEXT_PUBLIC_API_URL=http://192.168.1.100:3001/api
```

Then run `docker-compose up --build -d` so the frontend is rebuilt with that URL. Replace the host/port with your server’s address (and use `https://` if you put a reverse proxy in front).

## Deploy on Portainer

### Option A: Stack from Git (when build is supported)

1. In Portainer: **Stacks** → **Add stack**.
2. **Name:** e.g. `formel1dash`.
3. **Build method:** choose **Git repository**.
4. **Repository URL:** your repo (e.g. `https://github.com/YOUR_USER/Formel1Dash`).
5. **Repository reference:** leave empty or set a branch (e.g. `main`).
6. **Compose path:** `docker-compose.yml`.
7. **(Optional)** If the app is reached by another host (not localhost), add an **Environment variable**: `NEXT_PUBLIC_API_URL` = `http://YOUR_SERVER_IP_OR_HOST:3001/api`.
8. Click **Deploy the stack**.

Use a **Standalone** environment (not Swarm) so that `build` is supported. If you see *"Ignoring unsupported options: build"* or *"no image specified"*, use Option B.

### Option B: Pre-built images (Swarm or when build is disabled)

Portainer on Swarm (or with build disabled) cannot build from the repo. Build the images once on a machine with Docker, push to a registry, then deploy in Portainer using pre-built images.

**1. Build and push** (from project root, replace `YOUR_USER` with your Docker Hub username or use another registry):

```bash
docker-compose build
docker tag formel1dash-backend:latest YOUR_USER/formel1dash-backend:latest
docker tag formel1dash-frontend:latest YOUR_USER/formel1dash-frontend:latest
docker push YOUR_USER/formel1dash-backend:latest
docker push YOUR_USER/formel1dash-frontend:latest
```

For the frontend, if the app will be used at a different URL (e.g. `http://your-server:3000`), build with the API URL so the browser can reach the backend:

```bash
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:3001/api docker-compose build frontend
docker tag formel1dash-frontend:latest YOUR_USER/formel1dash-frontend:latest
docker push YOUR_USER/formel1dash-frontend:latest
```

**2. In Portainer:** **Stacks** → **Add stack** → **Web editor**. Paste the contents of `docker-compose.portainer.yml` from the repo, then add an environment variable:

- Name: `REGISTRY`  
- Value: `YOUR_USER` (Docker Hub) or e.g. `ghcr.io/YOUR_USER` (GitHub Container Registry)

Deploy the stack. Portainer will pull the images and start the services. Frontend: port **3000**, backend: **3001**. Data is stored in stack volumes.

## Project structure

```
/backend
  server.js           # Express app
  database.js         # SQLite init & connection
  routes/             # tracks, laps
  controllers/        # CRUD logic
  scripts/initDb.js   # DB migration/setup

/frontend
  app/
    page.tsx          # Home (links to dashboard & admin)
    dashboard/        # Live timing board
    admin/            # Tracks & lap management
  lib/api.ts          # API client
```

## License

MIT
