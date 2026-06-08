# Competitor Bank Analytics Dashboard

A full-stack application for competitor bank analytics with quarterly performance metrics and CAMEL analysis.

## Quick Start

### Prerequisites
- Python 3.9+ (with venv support)
- Node.js and npm

### Starting the Servers

#### 1. Start the Backend (FastAPI)
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at: **http://localhost:8000**

#### 2. Start the Frontend (React/Vite)
Open a **new terminal window** and run:
```bash
cd frontend
npm start
# or
npm run dev
```

The frontend will be available at: **http://localhost:5173**

### Accessing the Application

Once both servers are running:
- **Frontend**: Open http://localhost:5173 in your browser
- **Backend API**: http://localhost:8000
- **API Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs (Swagger UI)

## Project Structure

- `frontend/` - React + Vite frontend application
- `backend/` - FastAPI backend with SQLite database

## Notes

- Both servers need to be running simultaneously for the app to work
- The backend uses SQLite for data persistence
- The frontend connects to the backend API automatically via CORS
- Use `--reload` flag for auto-reload during development

## Performance

The dashboard loads in two phases for faster first paint:

1. **Initial load**: banks, quarters, and the 2 most recent reporting periods (`GET /metrics?recent_periods=2`)
2. **Background load**: full metric history for growth charts and tables

If the hosted backend feels slow on the first visit after idle time, that is usually a **Render cold start**. Fixes:

- Upgrade the Render web service to a paid always-on instance (free tier spins down after inactivity)
- Keep `/health` warm with an external uptime ping every 5–10 minutes
- Deploy with `healthCheckPath: /health` (see `render.yaml`)

Production baseline (warm backend): `/metrics` without filters returned ~669 KB / 5,646 rows. Using `recent_periods=2` reduces the first payload dramatically.

## Database

**Current default:** SQLite on Render persistent disk (`/data/bank_analytics.db`).

**When SQLite is enough:** single-instance deployment, moderate data volume, and low concurrent write traffic.

**When to move to Postgres:** multiple concurrent users, slow queries after optimization, or you want managed backups and easier scaling. The backend already supports Postgres via `DATABASE_URL` — set it to a Render Postgres or Supabase connection string and remove the persistent disk from `render.yaml`.

FastAPI remains required for XBRL parsing, Excel parsing, and forecasting regardless of database choice.
