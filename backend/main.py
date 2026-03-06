"""
main.py - FastAPI application for the Competitor Bank Analytics internal dashboard backend.

Provides health check, file upload (XBRL), and dashboard data endpoints.
Uses SQLite for persistence and CORS for localhost frontend access.
Run with: uvicorn main:app --reload
"""

import os
import io
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from sqlalchemy.orm import Session

from database import init_db, get_db
from models import QuarterlyMetric
from schemas import (
    HealthResponse,
    UploadResponse,
    DeleteUploadResponse,
    MetricResponse,
    MetricsListResponse,
)
from xbrl_parser import parse_xbrl_file
from camel_excel_parser import parse_camel_excel_from_filelike

# -----------------------------------------------------------------------------
# App and CORS
# -----------------------------------------------------------------------------

app = FastAPI(
    title="Competitor Bank Analytics API",
    description="Internal API for quarterly bank performance data and dashboards.",
    version="1.0.0",
)

# Security headers middleware – helps prevent XSS, clickjacking, MIME sniffing
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # CSP: allow same origin and API; adjust if you add external scripts
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self'"
        )
        return response


app.add_middleware(SecurityHeadersMiddleware)

frontend_url = os.environ.get("FRONTEND_URL", "")
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
    "http://luthersolution.com",
    "https://luthersolution.com",  # in case frontend is proxied
]
if frontend_url:
    # Also handle comma-separated lists if multiple URLs are provided
    for url in frontend_url.split(","):
        if url.strip():
            allowed_origins.append(url.strip())


# Allow frontend on localhost to call this API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create SQLite tables on startup
@app.on_event("startup")
def startup() -> None:
    """Ensure database tables exist when the app starts."""
    init_db()


# -----------------------------------------------------------------------------
# Favicon (stops browser from logging 404 for /favicon.ico)
# -----------------------------------------------------------------------------


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    """Return 204 so the browser stops requesting /favicon.ico and no 404 is logged."""
    return Response(status_code=204)


# -----------------------------------------------------------------------------
# Health check
# -----------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """
    Health check endpoint for load balancers and monitoring.
    Returns {"status": "ok"} when the service is up.
    """
    return HealthResponse(status="ok")


# -----------------------------------------------------------------------------
# File upload and parsing
# -----------------------------------------------------------------------------


def _parse_upload_to_rows(
    file: UploadFile,
    bank_name: Optional[str] = None,
    year: Optional[int] = None,
    quarter: Optional[int] = None,
) -> List[dict]:
    """
    Parse an uploaded XBRL file and extract quarterly bank metrics.

    Steps:
    1. Read file content into memory
    2. Validate file extension (.xbrl or .xml)
    3. Call XBRL parser to extract metrics (Revenue, Net Profit, Customer Accounts,
       Loans Outstanding, Deposits)
    4. Return list of {bank_id, year, quarter, metric_name, value} dicts

    Args:
        file: The uploaded XBRL file
        bank_name: Optional bank name provided by user. If provided, overrides bank_id extracted from file.

    Raises HTTPException if file is invalid or missing required metrics.
    """
    filename = file.filename or ""
    filename_lower = filename.lower()

    # Step 1: Validate file extension (XBRL files are typically .xbrl or .xml)
    if not (filename_lower.endswith(".xbrl") or filename_lower.endswith(".xml")):
        raise HTTPException(
            status_code=400,
            detail="Only XBRL files (.xbrl or .xml) are supported. PDF, SDF, and taxonomy downloads are not accepted.",
        )

    # Step 2: Read file content into memory
    try:
        file_content = file.file.read()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read file: {str(e)}",
        )

    if not file_content:
        raise HTTPException(
            status_code=400,
            detail="File is empty.",
        )

    # Step 3: Parse XBRL file using the parser module
    try:
        rows = parse_xbrl_file(
            file_content, filename, bank_name=bank_name, year=year, quarter=quarter
        )
    except ValueError as e:
        # ValueError from parser indicates invalid file or missing metrics
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except Exception as e:
        # Other errors (e.g., XML parsing, Arelle errors)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing XBRL file: {str(e)}",
        )

    # Step 4: Validate that we extracted at least some metrics
    if not rows:
        raise HTTPException(
            status_code=400,
            detail="No metrics found in XBRL file. Expected: Revenue, Net Profit, Customer Accounts, Loans Outstanding, Deposits",
        )

    return rows


def _upload_exists(db: Session, bank_id: str, year: int, quarter: int) -> bool:
    """
    Return True if any metric rows already exist for bank + year + quarter.
    """
    existing = (
        db.query(QuarterlyMetric.id)
        .filter(QuarterlyMetric.bank_id == bank_id)
        .filter(QuarterlyMetric.year == year)
        .filter(QuarterlyMetric.quarter == quarter)
        .first()
    )
    return existing is not None


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------


@app.post("/upload", response_model=UploadResponse)
def upload(
    file: UploadFile = File(...),
    bank_name: str = Form(...),
    year: int = Form(...),
    quarter: int = Form(..., ge=1, le=4),
    db: Session = Depends(get_db),
) -> UploadResponse:
    """
    Accept an XBRL file containing quarterly bank metrics.

    Parsing steps:
    1. Validate file is XBRL format (.xbrl or .xml)
    2. Extract metrics: Revenue, Net Profit, Customer Accounts, Loans Outstanding, Deposits
    3. Use provided bank_name, year, and quarter for all metrics
    4. Store each metric as a separate row in SQLite
    5. Data is processed once on upload so dashboards can read without recalculating

    Args:
        file: The XBRL file to upload
        bank_name: Name of the bank for this upload (required)
        year: Reporting year (required)
        quarter: Reporting quarter 1-4 (required)

    Returns error if file is invalid XBRL or missing required metrics.
    """
    normalized_bank_name = bank_name.strip()
    if not normalized_bank_name:
        raise HTTPException(status_code=400, detail="bank_name is required.")

    if _upload_exists(db, normalized_bank_name, year, quarter):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Upload already exists for {normalized_bank_name} {year} Q{quarter}. "
                "Delete the existing upload before uploading another file for the same bank and period."
            ),
        )

    # Step 1: Parse XBRL file to extract metrics
    rows = _parse_upload_to_rows(
        file,
        bank_name=normalized_bank_name,
        year=year,
        quarter=quarter,
    )

    if not rows:
        return UploadResponse(message="No valid metrics found in XBRL file.", rows_stored=0)

    # Step 2: Store each extracted metric in the database
    stored_count = 0
    for r in rows:
        try:
            db.add(
                QuarterlyMetric(
                    bank_id=str(r["bank_id"]).strip(),
                    year=int(r["year"]),
                    quarter=int(r["quarter"]),
                    metric_name=str(r["metric_name"]).strip(),
                    value=float(r["value"]),
                )
            )
            stored_count += 1
        except (ValueError, KeyError) as e:
            # Skip invalid rows but continue processing others
            continue

    db.commit()

    return UploadResponse(
        message=f"XBRL file processed successfully. Extracted {stored_count} metric(s).",
        rows_stored=stored_count,
    )


@app.post("/upload-camel-excel", response_model=UploadResponse)
async def upload_camel_excel(
    file: UploadFile = File(..., description="WSB Performance Dashboard Excel (.xlsx)"),
    bank_name: Optional[str] = Form(None, description="Override bank name from Excel title"),
    db: Session = Depends(get_db),
) -> UploadResponse:
    """
    Parse a WSB Performance Dashboard style Excel and store CAMEL metrics.

    Extracts metrics from sheets like FY24, FY 25. Each (bank, year, quarter) is stored;
    optional bank_name overrides the bank name from the workbook title.
    """
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are accepted for CAMEL upload.")
    try:
        content = await file.read()
        rows = parse_camel_excel_from_filelike(
            io.BytesIO(content),
            bank_name_override=bank_name.strip() if bank_name else None,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel: {e!s}")
    if not rows:
        return UploadResponse(message="No CAMEL metrics found in Excel file.", rows_stored=0)

    unique_periods = set()
    for r in rows:
        try:
            bank_id = str(r["bank_id"]).strip()
            row_year = int(r["year"])
            row_quarter = int(r["quarter"])
        except (KeyError, ValueError, TypeError):
            continue
        if not bank_id:
            continue
        unique_periods.add((bank_id, row_year, row_quarter))

    conflicts = sorted(
        (bank_id, row_year, row_quarter)
        for (bank_id, row_year, row_quarter) in unique_periods
        if _upload_exists(db, bank_id, row_year, row_quarter)
    )
    if conflicts:
        first_bank, first_year, first_quarter = conflicts[0]
        if len(conflicts) == 1:
            detail = (
                f"Upload already exists for {first_bank} {first_year} Q{first_quarter}. "
                "Delete the existing upload before uploading another file for the same bank and period."
            )
        else:
            sample = ", ".join(f"{b} {y} Q{q}" for b, y, q in conflicts[:3])
            detail = (
                "Upload contains periods that already exist. "
                f"Examples: {sample}. "
                "Delete existing uploads for those bank/period combinations before uploading again."
            )
        raise HTTPException(status_code=409, detail=detail)

    stored_count = 0
    for r in rows:
        try:
            db.add(
                QuarterlyMetric(
                    bank_id=str(r["bank_id"]).strip(),
                    year=int(r["year"]),
                    quarter=int(r["quarter"]),
                    metric_name=str(r["metric_name"]).strip(),
                    value=float(r["value"]),
                )
            )
            stored_count += 1
        except (ValueError, KeyError):
            continue
    db.commit()
    return UploadResponse(
        message=f"CAMEL Excel processed. Stored {stored_count} metric row(s).",
        rows_stored=stored_count,
    )


@app.get("/banks")
def list_banks(db: Session = Depends(get_db)) -> dict:
    """
    Return distinct bank identifiers for use in dashboard filters.
    """
    rows = db.query(QuarterlyMetric.bank_id).distinct().order_by(QuarterlyMetric.bank_id).all()
    return {"banks": [r[0] for r in rows]}


@app.get("/quarters")
def list_quarters(db: Session = Depends(get_db)) -> dict:
    """
    Return distinct (year, quarter) pairs for use in dashboard filters.
    """
    rows = (
        db.query(QuarterlyMetric.year, QuarterlyMetric.quarter)
        .distinct()
        .order_by(QuarterlyMetric.year.desc(), QuarterlyMetric.quarter.desc())
        .all()
    )
    return {"quarters": [{"year": r[0], "quarter": r[1]} for r in rows]}


@app.delete("/upload", response_model=DeleteUploadResponse)
def delete_upload(
    bank_name: str = Query(..., description="Bank name used at upload time"),
    year: int = Query(..., description="Reporting year"),
    quarter: int = Query(..., ge=1, le=4, description="Reporting quarter (1-4)"),
    db: Session = Depends(get_db),
) -> DeleteUploadResponse:
    """
    Delete an uploaded dataset (bank + year + quarter).

    Note: uploads are stored as rows in `quarterly_metrics`, so deleting an upload
    means deleting all metric rows for that bank/year/quarter.
    """
    bank_name = bank_name.strip()
    if not bank_name:
        raise HTTPException(status_code=400, detail="bank_name is required.")

    q = (
        db.query(QuarterlyMetric)
        .filter(QuarterlyMetric.bank_id == bank_name)
        .filter(QuarterlyMetric.year == year)
        .filter(QuarterlyMetric.quarter == quarter)
    )
    rows_deleted = q.delete(synchronize_session=False)
    db.commit()

    return DeleteUploadResponse(
        message=f"Deleted upload for {bank_name} {year} Q{quarter}.",
        rows_deleted=int(rows_deleted),
    )


@app.get("/metrics", response_model=MetricsListResponse)
def get_metrics(
    db: Session = Depends(get_db),
    bank_id: Optional[str] = Query(None, description="Filter by bank identifier"),
    year: Optional[int] = Query(None, description="Filter by year"),
    quarter: Optional[int] = Query(None, ge=1, le=4, description="Filter by quarter (1-4)"),
) -> MetricsListResponse:
    """
    Return stored metrics for dashboards. Optional filters: bank_id, year, quarter.
    """
    q = db.query(QuarterlyMetric)
    if bank_id is not None:
        q = q.filter(QuarterlyMetric.bank_id == bank_id)
    if year is not None:
        q = q.filter(QuarterlyMetric.year == year)
    if quarter is not None:
        q = q.filter(QuarterlyMetric.quarter == quarter)
    q = q.order_by(QuarterlyMetric.year.desc(), QuarterlyMetric.quarter.desc(), QuarterlyMetric.bank_id)
    rows = q.all()
    metrics = [
        MetricResponse(
            id=r.id,
            bank_id=r.bank_id,
            year=r.year,
            quarter=r.quarter,
            metric_name=r.metric_name,
            value=r.value,
        )
        for r in rows
    ]
    return MetricsListResponse(metrics=metrics, count=len(metrics))
