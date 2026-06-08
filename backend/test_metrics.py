import os
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

TEMP_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
TEMP_DB.close()

os.environ["DATABASE_URL"] = f"sqlite:///{TEMP_DB.name}"

import main as app_module  # noqa: E402
from database import SessionLocal, init_db  # noqa: E402
from models import QuarterlyMetric  # noqa: E402


class MetricsEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        init_db()
        cls.client = TestClient(app_module.app)
        cls._seed_db()

    @classmethod
    def _seed_db(cls) -> None:
        db = SessionLocal()
        try:
            rows = [
                ("Bank A", 2024, 1, "revenue", 100.0),
                ("Bank A", 2024, 2, "revenue", 110.0),
                ("Bank A", 2024, 3, "revenue", 120.0),
                ("Bank B", 2024, 2, "revenue", 200.0),
                ("Bank B", 2024, 3, "revenue", 210.0),
            ]
            for bank_id, year, quarter, metric_name, value in rows:
                db.add(
                    QuarterlyMetric(
                        bank_id=bank_id,
                        year=year,
                        quarter=quarter,
                        metric_name=metric_name,
                        value=value,
                    )
                )
            db.commit()
        finally:
            db.close()

    def test_recent_periods_limits_rows(self) -> None:
        res = self.client.get("/metrics?recent_periods=1")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload["count"], 2)
        self.assertEqual(len(payload["metrics"]), 2)
        for metric in payload["metrics"]:
            self.assertEqual(metric["year"], 2024)
            self.assertEqual(metric["quarter"], 3)

    def test_limit_and_offset(self) -> None:
        res = self.client.get("/metrics?limit=2&offset=1")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload["count"], 5)
        self.assertEqual(len(payload["metrics"]), 2)


if __name__ == "__main__":
    unittest.main()
