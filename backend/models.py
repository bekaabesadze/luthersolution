"""
models.py - SQLAlchemy ORM models for Competitor Bank Analytics quarterly data.

Stores one row per metric per bank per quarter so that uploads can be
processed once and dashboards can query without recalculating.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class QuarterlyMetric(Base):
    """
    One numeric metric for a given bank and quarter.

    bank_id: identifier or name of the bank (from uploaded file).
    year, quarter: reporting period (e.g. 2024, 2 for Q2).
    metric_name: name of the metric (e.g. revenue, assets).
    value: numeric value for the metric.
    """

    __tablename__ = "quarterly_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bank_id = Column(String(255), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    quarter = Column(Integer, nullable=False, index=True)
    metric_name = Column(String(255), nullable=False, index=True)
    value = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
