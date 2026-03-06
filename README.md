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
