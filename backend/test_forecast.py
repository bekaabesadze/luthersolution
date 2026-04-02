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
os.environ["ADMIN_PASSWORD"] = "test-admin"
os.environ["JWT_SECRET_KEY"] = "forecast-test-secret"

import main as app_module  # noqa: E402
from database import SessionLocal, init_db  # noqa: E402
from models import QuarterlyMetric  # noqa: E402


def _add_metric(db, bank_id: str, year: int, quarter: int, metric_name: str, value: float) -> None:
    db.add(
        QuarterlyMetric(
            bank_id=bank_id,
            year=year,
            quarter=quarter,
            metric_name=metric_name,
            value=value,
        )
    )


class ForecastEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        init_db()
        cls.client = TestClient(app_module.app)
        cls._seed_db()
        token_res = cls.client.post(
            "/token",
            data={"username": "admin", "password": app_module.ADMIN_PASSWORD},
        )
        assert token_res.status_code == 200, token_res.text
        cls.auth_headers = {"Authorization": f"Bearer {token_res.json()['access_token']}"}

    @classmethod
    def tearDownClass(cls) -> None:
        try:
            os.unlink(TEMP_DB.name)
        except FileNotFoundError:
            pass

    @classmethod
    def _seed_db(cls) -> None:
        db = SessionLocal()
        try:
            metric_values = {
                "Alpha Bank": {
                    "deposits": [100.0, 110.0, 121.0, 133.1],
                    "loans_outstanding": [78.0, 82.0, 86.0, 90.0],
                    "total_assets": [145.0, 152.0, 160.0, 168.0],
                    "total_equity": [14.5, 15.2, 16.0, 16.8],
                    "net_profit": [3.2, 3.5, 3.8, 4.1],
                    "allowance_for_credit_losses": [2.0, 2.1, 2.2, 2.3],
                    "past_due_30_89_amount": [1.1, 1.2, 1.3, 1.4],
                    "past_due_90_plus_amount": [0.6, 0.65, 0.7, 0.75],
                    "nonaccrual_loans_amount": [0.35, 0.38, 0.42, 0.45],
                    "brokered_deposits_amount": [9.0, 9.5, 10.0, 10.5],
                    "tier1_leverage_ratio": [0.1, 0.101, 0.102, 0.103],
                },
                "Bravo Bank": {
                    "deposits": [120.0, 123.0, 127.0, 131.0],
                    "loans_outstanding": [84.0, 86.0, 88.0, 90.5],
                    "total_assets": [155.0, 158.0, 162.0, 166.0],
                    "total_equity": [16.5, 16.8, 17.0, 17.4],
                    "net_profit": [2.8, 3.0, 3.1, 3.25],
                    "allowance_for_credit_losses": [2.1, 2.15, 2.2, 2.25],
                    "past_due_30_89_amount": [0.9, 1.0, 1.05, 1.1],
                    "past_due_90_plus_amount": [0.5, 0.52, 0.55, 0.57],
                    "nonaccrual_loans_amount": [0.31, 0.33, 0.34, 0.36],
                    "brokered_deposits_amount": [12.0, 12.2, 12.4, 12.6],
                },
                "Thin Bank": {
                    "deposits": [62.0, 66.0, 70.0],
                    "loans_outstanding": [40.0, 42.0, 45.0],
                    "total_assets": [78.0, 81.0, 85.0],
                    "total_equity": [8.0, 8.2, 8.4],
                    "net_profit": [1.5, 1.6, 1.7],
                    "allowance_for_credit_losses": [1.2, 1.25, 1.3],
                    "past_due_30_89_amount": [0.3, 0.31, 0.33],
                    "past_due_90_plus_amount": [0.15, 0.16, 0.18],
                    "nonaccrual_loans_amount": [0.08, 0.09, 0.09],
                    "brokered_deposits_amount": [2.0, 2.1, 2.2],
                },
                "Downturn Bank": {
                    "deposits": [30.0, 18.0, 7.0, 0.6],
                    "loans_outstanding": [20.0, 18.0, 14.0, 9.0],
                    "total_assets": [42.0, 34.0, 22.0, 12.0],
                    "total_equity": [6.0, 4.8, 3.5, 2.4],
                    "net_profit": [0.8, 0.3, -0.4, -0.7],
                    "allowance_for_credit_losses": [1.3, 1.35, 1.4, 1.5],
                    "past_due_30_89_amount": [0.4, 0.55, 0.75, 1.0],
                    "past_due_90_plus_amount": [0.2, 0.25, 0.3, 0.45],
                    "nonaccrual_loans_amount": [0.1, 0.18, 0.24, 0.32],
                    "brokered_deposits_amount": [3.0, 2.0, 1.0, 0.2],
                },
            }

            for bank_id, metrics in metric_values.items():
                periods = len(next(iter(metrics.values())))
                for index in range(periods):
                    year = 2024
                    quarter = index + 1
                    for metric_name, values in metrics.items():
                        _add_metric(db, bank_id, year, quarter, metric_name, values[index])

            db.commit()
        finally:
            db.close()

    def test_forecast_requires_authentication(self) -> None:
        response = self.client.post(
            "/forecast",
            json={"primary_bank_id": "Alpha Bank", "peer_bank_ids": [], "horizon_quarters": 4},
        )
        self.assertEqual(response.status_code, 401)

    def test_forecast_clamps_horizon_to_four_quarters(self) -> None:
        response = self.client.post(
            "/forecast",
            headers=self.auth_headers,
            json={"primary_bank_id": "Alpha Bank", "peer_bank_ids": ["Bravo Bank"], "horizon_quarters": 99},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(len(payload["forecast_periods"]), 4)

    def test_forecast_marks_metrics_with_thin_history_as_unavailable(self) -> None:
        response = self.client.post(
            "/forecast",
            headers=self.auth_headers,
            json={"primary_bank_id": "Thin Bank", "peer_bank_ids": [], "horizon_quarters": 4},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        deposits_series = next(item for item in payload["metric_series"] if item["metric_id"] == "deposits")
        self.assertEqual(deposits_series["status"], "insufficient_history")
        self.assertTrue(
            any(
                item["metric_id"] == "deposits" and item["bank_id"] == "Thin Bank"
                for item in payload["unavailable_metrics"]
            )
        )

    def test_forecast_clamps_non_negative_metrics_at_zero(self) -> None:
        response = self.client.post(
            "/forecast",
            headers=self.auth_headers,
            json={"primary_bank_id": "Downturn Bank", "peer_bank_ids": [], "horizon_quarters": 4},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        deposits_series = next(item for item in payload["metric_series"] if item["metric_id"] == "deposits")
        forecast_points = [point for point in deposits_series["primary_points"] if point["is_forecast"]]
        self.assertEqual(len(forecast_points), 4)
        self.assertTrue(all(point["value"] >= 0 for point in forecast_points))

    def test_forecast_confidence_band_wraps_baseline(self) -> None:
        response = self.client.post(
            "/forecast",
            headers=self.auth_headers,
            json={"primary_bank_id": "Alpha Bank", "peer_bank_ids": ["Bravo Bank"], "horizon_quarters": 4},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        deposits_series = next(item for item in payload["metric_series"] if item["metric_id"] == "deposits")
        for point in deposits_series["primary_points"]:
            if not point["is_forecast"]:
                continue
            self.assertLessEqual(point["lower"], point["value"])
            self.assertGreaterEqual(point["upper"], point["value"])

    def test_forecast_recomputes_loan_to_deposit_ratio_from_predicted_drivers(self) -> None:
        response = self.client.post(
            "/forecast",
            headers=self.auth_headers,
            json={"primary_bank_id": "Alpha Bank", "peer_bank_ids": ["Bravo Bank"], "horizon_quarters": 4},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        loans_series = next(item for item in payload["metric_series"] if item["metric_id"] == "loans_outstanding")
        deposits_series = next(item for item in payload["metric_series"] if item["metric_id"] == "deposits")
        acl_series = next(item for item in payload["metric_series"] if item["metric_id"] == "allowance_for_credit_losses")
        ratio_series = next(item for item in payload["metric_series"] if item["metric_id"] == "loan_to_deposit_ratio")

        first_forecast_loans = next(point for point in loans_series["primary_points"] if point["is_forecast"])
        first_forecast_deposits = next(point for point in deposits_series["primary_points"] if point["is_forecast"])
        first_forecast_acl = next(point for point in acl_series["primary_points"] if point["is_forecast"])
        first_forecast_ratio = next(point for point in ratio_series["primary_points"] if point["is_forecast"])

        expected_ratio = (first_forecast_loans["value"] - first_forecast_acl["value"]) / first_forecast_deposits["value"]
        self.assertAlmostEqual(first_forecast_ratio["value"], expected_ratio, places=6)


if __name__ == "__main__":
    unittest.main()
