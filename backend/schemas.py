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


class ForecastRequest(BaseModel):
    """Request body for POST /forecast."""

    primary_bank_id: str
    peer_bank_ids: List[str] = []
    horizon_quarters: int = 4


class ForecastPeriodResponse(BaseModel):
    """Shared period payload used across the forecast response."""

    year: int
    quarter: int
    key: str
    label: str
    relative_label: Optional[str] = None


class ForecastSummaryCardResponse(BaseModel):
    """Top-level executive runway card for one future quarter."""

    year: int
    quarter: int
    key: str
    label: str
    relative_label: Optional[str] = None
    quarter_label: str
    period_label: str
    deposit_growth_pct: Optional[float] = None
    loan_growth_pct: Optional[float] = None
    net_profit: Optional[float] = None
    loan_to_deposit_ratio: Optional[float] = None
    status: str


class ForecastPointResponse(BaseModel):
    """Single historical or forecasted point for a metric series."""

    year: int
    quarter: int
    key: str
    label: str
    value: Optional[float] = None
    lower: Optional[float] = None
    upper: Optional[float] = None
    is_forecast: bool


class ForecastPeerRankingResponse(BaseModel):
    """Peer ranking row for a forecasted metric."""

    bank_id: str
    rank: int
    latest_actual: Optional[float] = None
    projected_value: Optional[float] = None
    change_pct: Optional[float] = None
    status: str
    unavailable_reason: Optional[str] = None


class ForecastMetricSeriesResponse(BaseModel):
    """Metric-specific forecast response for charts, rankings, and the matrix."""

    metric_id: str
    label: str
    format: str
    status: str
    unavailable_reason: Optional[str] = None
    primary_points: List[ForecastPointResponse]
    peer_median_points: List[ForecastPointResponse]
    peer_rankings: List[ForecastPeerRankingResponse]


class ForecastUnavailableMetricResponse(BaseModel):
    """Explains why a metric is unavailable for a bank."""

    bank_id: str
    metric_id: str
    label: str
    reason: str


class ForecastResponse(BaseModel):
    """Response body for POST /forecast."""

    generated_at: str
    primary_bank_id: str
    peer_bank_ids: List[str]
    history_periods: List[ForecastPeriodResponse]
    forecast_periods: List[ForecastPeriodResponse]
    summary_cards: List[ForecastSummaryCardResponse]
    metric_series: List[ForecastMetricSeriesResponse]
    unavailable_metrics: List[ForecastUnavailableMetricResponse]
