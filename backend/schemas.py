"""
schemas.py - Pydantic request/response models for the Competitor Bank Analytics API.

Used for validation and OpenAPI docs; keeps API contracts clear.
"""

from typing import List, Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response body for GET /health."""

    status: str


class UploadResponse(BaseModel):
    """Response body for POST /upload after successful processing."""

    message: str
    rows_stored: int


class DeleteUploadResponse(BaseModel):
    """Response body for DELETE /upload (delete one upload group)."""

    message: str
    rows_deleted: int


class MetricResponse(BaseModel):
    """Single metric row for dashboard consumption."""

    id: int
    bank_id: str
    year: int
    quarter: int
    metric_name: str
    value: float

    class Config:
        from_attributes = True


class MetricsListResponse(BaseModel):
    """List of metrics returned by GET /metrics."""

    metrics: List[MetricResponse]
    count: int
