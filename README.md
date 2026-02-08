# F1 Timing Dashboard

A professional Formula 1 timing board dashboard with a live display and admin backend to manage tracks and lap times.

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

## Docker (optional)

From project root:

```bash
docker-compose up -d
```

- Frontend: http://localhost:3000  
- Backend API: http://localhost:3001  

Database file is persisted in a volume; restarting containers keeps data.

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
