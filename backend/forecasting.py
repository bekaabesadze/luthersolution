"""
forecasting.py - Bank outlook forecasting utilities.

Builds a premium, explainable forecast response from stored quarterly metrics.
Forecasts are intentionally conservative:
- only a curated set of raw XBRL-backed metrics are forecasted
- derived CAMEL-style ratios are recomputed from forecasted raw drivers
- metrics need at least 4 quarters of history to produce forward-looking values
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import expm1, isfinite, log1p, sqrt
from statistics import median
from typing import Dict, Iterable, List, Optional, Tuple


MIN_HISTORY_POINTS = 4
MAX_FORECAST_HORIZON = 4
CONFIDENCE_Z_80 = 1.2815515655446004
EXPLICIT_TIER1_METRIC = "tier1_leverage_ratio"


@dataclass(frozen=True)
class MetricDefinition:
    id: str
    label: str
    format: str
    raw_name: Optional[str] = None
    non_negative: bool = False
    max_relative_step: float = 0.22


RAW_METRIC_DEFINITIONS: List[MetricDefinition] = [
    MetricDefinition("deposits", "Deposits", "currency", raw_name="deposits", non_negative=True, max_relative_step=0.18),
    MetricDefinition("loans_outstanding", "Loans Outstanding", "currency", raw_name="loans_outstanding", non_negative=True, max_relative_step=0.18),
    MetricDefinition("total_assets", "Total Assets", "currency", raw_name="total_assets", non_negative=True, max_relative_step=0.16),
    MetricDefinition("total_equity", "Total Equity", "currency", raw_name="total_equity", non_negative=True, max_relative_step=0.16),
    MetricDefinition("net_profit", "Net Profit", "currency", raw_name="net_profit", non_negative=False, max_relative_step=0.0),
    MetricDefinition("allowance_for_credit_losses", "Allowance for Credit Losses", "currency", raw_name="allowance_for_credit_losses", non_negative=True, max_relative_step=0.32),
    MetricDefinition("past_due_30_89_amount", "Past Due 30-89 Amount", "currency", raw_name="past_due_30_89_amount", non_negative=True, max_relative_step=0.4),
    MetricDefinition("past_due_90_plus_amount", "Past Due 90+ Amount", "currency", raw_name="past_due_90_plus_amount", non_negative=True, max_relative_step=0.4),
    MetricDefinition("nonaccrual_loans_amount", "Nonaccrual Loans Amount", "currency", raw_name="nonaccrual_loans_amount", non_negative=True, max_relative_step=0.4),
    MetricDefinition("brokered_deposits_amount", "Brokered Deposits Amount", "currency", raw_name="brokered_deposits_amount", non_negative=True, max_relative_step=0.35),
]

DERIVED_METRIC_DEFINITIONS: List[MetricDefinition] = [
    MetricDefinition("equity_to_assets", "Equity to Assets", "percent"),
    MetricDefinition("tier1_leverage_ratio", "Tier 1 Leverage Ratio", "percent"),
    MetricDefinition("loan_to_deposit_ratio", "Loan to Deposit Ratio", "percent"),
    MetricDefinition("acl_to_total_loans", "ACL / Total Loans", "percent"),
    MetricDefinition("past_due_30_89_to_total_loans", "Past Due 30-89 / Total Loans", "percent"),
    MetricDefinition("past_due_90_plus_nonaccrual_to_total_loans", "90+ PD and Non-Accrual / Total Loans", "percent"),
    MetricDefinition("non_performing_assets_to_equity_reserves", "Non Performing Assets to Equity + Reserves", "percent"),
    MetricDefinition("brokered_deposits_to_total_deposits", "Brokered Deposits to Total Deposits", "percent"),
]

METRIC_DEFINITIONS: List[MetricDefinition] = [
    *RAW_METRIC_DEFINITIONS,
    *DERIVED_METRIC_DEFINITIONS,
]
METRIC_DEFINITION_BY_ID = {metric.id: metric for metric in METRIC_DEFINITIONS}
RAW_METRIC_DEFINITION_BY_ID = {metric.id: metric for metric in RAW_METRIC_DEFINITIONS}
SUPPORTED_QUERY_METRICS = {metric.raw_name for metric in RAW_METRIC_DEFINITIONS if metric.raw_name}
SUPPORTED_QUERY_METRICS.add(EXPLICIT_TIER1_METRIC)


@dataclass
class ForecastPoint:
    value: float
    lower: float
    upper: float


@dataclass
class RawMetricForecast:
    actuals: Dict[int, float]
    forecasts: Dict[int, ForecastPoint]
    status: str
    unavailable_reason: Optional[str]


def period_index(year: int, quarter: int) -> int:
    return year * 4 + (quarter - 1)


def index_to_period(index: int) -> Tuple[int, int]:
    year = index // 4
    quarter = (index % 4) + 1
    return year, quarter


def period_payload(index: int, relative_label: Optional[str] = None) -> Dict[str, object]:
    year, quarter = index_to_period(index)
    payload: Dict[str, object] = {
        "year": year,
        "quarter": quarter,
        "key": f"{year}-Q{quarter}",
        "label": f"{year} Q{quarter}",
    }
    if relative_label is not None:
        payload["relative_label"] = relative_label
    return payload


def _safe_number(value: object) -> Optional[float]:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    return num if isfinite(num) else None


def build_bank_period_maps(rows: Iterable[object]) -> Dict[str, Dict[int, Dict[str, float]]]:
    deduped: Dict[Tuple[str, int, int, str], object] = {}
    for row in rows:
        key = (row.bank_id, row.year, row.quarter, row.metric_name)
        current = deduped.get(key)
        if current is None or row.id > current.id:
            deduped[key] = row

    bank_periods: Dict[str, Dict[int, Dict[str, float]]] = {}
    for row in deduped.values():
        numeric_value = _safe_number(row.value)
        if numeric_value is None:
            continue
        idx = period_index(int(row.year), int(row.quarter))
        bank_periods.setdefault(str(row.bank_id), {}).setdefault(idx, {})[str(row.metric_name)] = numeric_value
    return bank_periods


def _weighted_linear_regression(xs: List[int], ys: List[float], weights: List[float]) -> Tuple[float, float]:
    total_weight = sum(weights)
    if total_weight <= 0:
        return 0.0, ys[-1] if ys else 0.0

    mean_x = sum(weight * x for weight, x in zip(weights, xs)) / total_weight
    mean_y = sum(weight * y for weight, y in zip(weights, ys)) / total_weight

    numerator = sum(weight * (x - mean_x) * (y - mean_y) for weight, x, y in zip(weights, xs, ys))
    denominator = sum(weight * (x - mean_x) ** 2 for weight, x in zip(weights, xs))

    slope = numerator / denominator if denominator else 0.0
    intercept = mean_y - slope * mean_x
    return slope, intercept


def _clamp_non_negative_predictions(
    predictions: List[float],
    last_actual: float,
    max_relative_step: float,
) -> List[float]:
    if not predictions:
        return []

    previous = max(0.0, last_actual)
    clamped: List[float] = []
    for prediction in predictions:
        current = max(0.0, prediction)
        if previous > 0:
            lower_bound = previous * max(0.0, 1.0 - max_relative_step)
            upper_bound = previous * (1.0 + max_relative_step)
            current = max(lower_bound, min(current, upper_bound))
        clamped.append(current)
        previous = current
    return clamped


def _clamp_linear_predictions(
    predictions: List[float],
    last_actual: float,
    residual_scale: float,
) -> List[float]:
    if not predictions:
        return []

    previous = last_actual
    clamped: List[float] = []
    for prediction in predictions:
        drift_cap = max(abs(previous) * 0.65, residual_scale * 2.25, 1.0)
        current = max(previous - drift_cap, min(prediction, previous + drift_cap))
        clamped.append(current)
        previous = current
    return clamped


def _forecast_raw_metric(
    actuals: Dict[int, float],
    target_indices: List[int],
    definition: MetricDefinition,
) -> RawMetricForecast:
    if not actuals:
        return RawMetricForecast(actuals={}, forecasts={}, status="no_data", unavailable_reason="No historical values are available.")

    ordered_points = sorted(actuals.items())
    xs = [idx for idx, _ in ordered_points]
    raw_ys = [value for _, value in ordered_points]

    if len(ordered_points) < MIN_HISTORY_POINTS:
        return RawMetricForecast(
            actuals=dict(ordered_points),
            forecasts={},
            status="insufficient_history",
            unavailable_reason=(
                f"Needs at least {MIN_HISTORY_POINTS} quarters of {definition.label.lower()} history; "
                f"only {len(ordered_points)} quarter{'s' if len(ordered_points) != 1 else ''} available."
            ),
        )

    transformed_ys = [log1p(max(value, 0.0)) if definition.non_negative else value for value in raw_ys]
    weights = [float(index + 1) for index in range(len(xs))]
    slope, intercept = _weighted_linear_regression(xs, transformed_ys, weights)

    fitted = [intercept + slope * x for x in xs]
    residuals = [actual - fit for actual, fit in zip(transformed_ys, fitted)]
    residual_variance = 0.0
    if len(residuals) > 1:
        residual_variance = sum(residual ** 2 for residual in residuals) / (len(residuals) - 1)
    residual_scale = sqrt(max(residual_variance, 0.0))

    predicted_transformed = [intercept + slope * x for x in target_indices]
    predicted_raw = [
        expm1(value) if definition.non_negative else value for value in predicted_transformed
    ]

    if definition.non_negative:
        baseline_values = _clamp_non_negative_predictions(predicted_raw, raw_ys[-1], definition.max_relative_step)
    else:
        baseline_values = _clamp_linear_predictions(predicted_raw, raw_ys[-1], residual_scale)

    forecasts: Dict[int, ForecastPoint] = {}
    for offset, (target_index, baseline_value) in enumerate(zip(target_indices, baseline_values), start=1):
        horizon_scale = sqrt(float(offset))
        lower_transformed = predicted_transformed[offset - 1] - (CONFIDENCE_Z_80 * residual_scale * horizon_scale)
        upper_transformed = predicted_transformed[offset - 1] + (CONFIDENCE_Z_80 * residual_scale * horizon_scale)

        if definition.non_negative:
            lower_value = max(0.0, expm1(lower_transformed))
            upper_value = max(0.0, expm1(upper_transformed))
        else:
            lower_value = lower_transformed
            upper_value = upper_transformed

        lower_bound = min(lower_value, baseline_value, upper_value)
        upper_bound = max(lower_value, baseline_value, upper_value)

        forecasts[target_index] = ForecastPoint(
            value=baseline_value,
            lower=lower_bound,
            upper=upper_bound,
        )

    return RawMetricForecast(
        actuals=dict(ordered_points),
        forecasts=forecasts,
        status="ready",
        unavailable_reason=None,
    )


def _derived_value(metric_id: str, values: Dict[str, float]) -> Optional[float]:
    loans = values.get("loans_outstanding")
    deposits = values.get("deposits")
    total_assets = values.get("total_assets")
    total_equity = values.get("total_equity")
    acl = values.get("allowance_for_credit_losses")
    past_due_30_89 = values.get("past_due_30_89_amount")
    past_due_90_plus = values.get("past_due_90_plus_amount")
    nonaccrual = values.get("nonaccrual_loans_amount")
    brokered = values.get("brokered_deposits_amount")
    explicit_tier1 = values.get(EXPLICIT_TIER1_METRIC)

    if metric_id == "equity_to_assets":
        if total_equity is None or total_assets in (None, 0):
            return None
        return total_equity / total_assets

    if metric_id == "tier1_leverage_ratio":
        if explicit_tier1 is not None:
            return explicit_tier1
        if total_equity is None or total_assets in (None, 0):
            return None
        return total_equity / total_assets

    if metric_id == "loan_to_deposit_ratio":
        if loans is None or deposits in (None, 0) or acl is None:
            return None
        return (loans - acl) / deposits

    if metric_id == "acl_to_total_loans":
        if acl is None or loans in (None, 0):
            return None
        return acl / loans

    if metric_id == "past_due_30_89_to_total_loans":
        if past_due_30_89 is None or loans in (None, 0):
            return None
        return past_due_30_89 / loans

    if metric_id == "past_due_90_plus_nonaccrual_to_total_loans":
        if past_due_90_plus is None or nonaccrual is None or loans in (None, 0):
            return None
        return (past_due_90_plus + nonaccrual) / loans

    if metric_id == "non_performing_assets_to_equity_reserves":
        if past_due_90_plus is None or nonaccrual is None or total_equity is None or acl is None:
            return None
        denominator = total_equity + acl
        if denominator == 0:
            return None
        return (past_due_90_plus + nonaccrual) / denominator

    if metric_id == "brokered_deposits_to_total_deposits":
        if brokered is None or deposits in (None, 0):
            return None
        return brokered / deposits

    return None


def _merge_period_values(
    actual_period_values: Dict[int, Dict[str, float]],
    raw_metric_forecasts: Dict[str, RawMetricForecast],
    target_indices: List[int],
) -> Dict[int, Dict[str, float]]:
    merged: Dict[int, Dict[str, float]] = {
        period_idx: dict(values) for period_idx, values in actual_period_values.items()
    }
    for target_index in target_indices:
        merged.setdefault(target_index, {})
        for metric_id, forecast in raw_metric_forecasts.items():
            point = forecast.forecasts.get(target_index)
            if point is not None:
                merged[target_index][metric_id] = point.value
    return merged


def _metric_value_for_period(
    metric_id: str,
    period_values: Dict[str, float],
) -> Optional[float]:
    raw_definition = RAW_METRIC_DEFINITION_BY_ID.get(metric_id)
    if raw_definition and raw_definition.raw_name:
        return period_values.get(raw_definition.raw_name)
    return _derived_value(metric_id, period_values)


def _metric_unavailable_reason(
    metric_id: str,
    bank_id: str,
    bank_period_values: Dict[int, Dict[str, float]],
    raw_metric_forecasts: Dict[str, RawMetricForecast],
) -> Optional[str]:
    raw_definition = RAW_METRIC_DEFINITION_BY_ID.get(metric_id)
    if raw_definition:
        forecast = raw_metric_forecasts.get(metric_id)
        return forecast.unavailable_reason if forecast else f"No {raw_definition.label.lower()} history is available for {bank_id}."

    if metric_id == "equity_to_assets":
        required = ("total_equity", "total_assets")
    elif metric_id == "tier1_leverage_ratio":
        required = ("total_equity", "total_assets")
    elif metric_id == "loan_to_deposit_ratio":
        required = ("loans_outstanding", "allowance_for_credit_losses", "deposits")
    elif metric_id == "acl_to_total_loans":
        required = ("allowance_for_credit_losses", "loans_outstanding")
    elif metric_id == "past_due_30_89_to_total_loans":
        required = ("past_due_30_89_amount", "loans_outstanding")
    elif metric_id == "past_due_90_plus_nonaccrual_to_total_loans":
        required = ("past_due_90_plus_amount", "nonaccrual_loans_amount", "loans_outstanding")
    elif metric_id == "non_performing_assets_to_equity_reserves":
        required = ("past_due_90_plus_amount", "nonaccrual_loans_amount", "total_equity", "allowance_for_credit_losses")
    elif metric_id == "brokered_deposits_to_total_deposits":
        required = ("brokered_deposits_amount", "deposits")
    else:
        required = ()

    missing_labels: List[str] = []
    for raw_metric_id in required:
        raw_definition = RAW_METRIC_DEFINITION_BY_ID[raw_metric_id]
        forecast = raw_metric_forecasts.get(raw_metric_id)
        if forecast and forecast.status == "ready":
            continue
        missing_labels.append(raw_definition.label)

    if not missing_labels and metric_id == "tier1_leverage_ratio":
        for period_values in bank_period_values.values():
            if EXPLICIT_TIER1_METRIC in period_values:
                return None

    if not missing_labels:
        return None

    if len(missing_labels) == 1:
        return f"Forecast needs stable {missing_labels[0].lower()} history for {bank_id}."
    joined = ", ".join(label.lower() for label in missing_labels[:-1]) + f", and {missing_labels[-1].lower()}"
    return f"Forecast needs stable {joined} history for {bank_id}."


def _metric_series_for_bank(
    bank_id: str,
    metric: MetricDefinition,
    actual_period_values: Dict[int, Dict[str, float]],
    merged_period_values: Dict[int, Dict[str, float]],
    raw_metric_forecasts: Dict[str, RawMetricForecast],
    target_indices: List[int],
) -> Dict[str, object]:
    actual_points: Dict[int, float] = {}
    for period_idx, values in actual_period_values.items():
        metric_value = _metric_value_for_period(metric.id, values)
        if metric_value is not None:
            actual_points[period_idx] = metric_value

    forecast_points: Dict[int, ForecastPoint] = {}
    if metric.id in RAW_METRIC_DEFINITION_BY_ID:
        raw_forecast = raw_metric_forecasts[metric.id]
        forecast_points = dict(raw_forecast.forecasts)
        status = raw_forecast.status
        unavailable_reason = raw_forecast.unavailable_reason
    else:
        for target_index in target_indices:
            metric_value = _metric_value_for_period(metric.id, merged_period_values.get(target_index, {}))
            if metric_value is None:
                continue
            forecast_points[target_index] = ForecastPoint(value=metric_value, lower=metric_value, upper=metric_value)
        status = "ready" if len(forecast_points) == len(target_indices) else "insufficient_history"
        unavailable_reason = None if status == "ready" else _metric_unavailable_reason(
            metric.id,
            bank_id,
            actual_period_values,
            raw_metric_forecasts,
        )

    return {
        "actual_points": actual_points,
        "forecast_points": forecast_points,
        "status": status,
        "unavailable_reason": unavailable_reason,
    }


def _bank_metric_maps_for_response(
    bank_id: str,
    bank_period_values: Dict[int, Dict[str, float]],
    target_indices: List[int],
) -> Tuple[Dict[str, Dict[str, object]], Dict[int, Dict[str, float]]]:
    raw_metric_forecasts = {
        metric.id: _forecast_raw_metric(
            {
                period_idx: values[metric.raw_name]
                for period_idx, values in bank_period_values.items()
                if metric.raw_name in values
            },
            target_indices,
            metric,
        )
        for metric in RAW_METRIC_DEFINITIONS
    }
    merged_period_values = _merge_period_values(bank_period_values, raw_metric_forecasts, target_indices)
    metric_maps = {
        metric.id: _metric_series_for_bank(
            bank_id=bank_id,
            metric=metric,
            actual_period_values=bank_period_values,
            merged_period_values=merged_period_values,
            raw_metric_forecasts=raw_metric_forecasts,
            target_indices=target_indices,
        )
        for metric in METRIC_DEFINITIONS
    }
    return metric_maps, merged_period_values


def _series_points(
    primary_metric_map: Dict[str, object],
    target_indices: List[int],
) -> List[Dict[str, object]]:
    actual_points: Dict[int, float] = primary_metric_map["actual_points"]  # type: ignore[assignment]
    forecast_points: Dict[int, ForecastPoint] = primary_metric_map["forecast_points"]  # type: ignore[assignment]
    timeline = sorted(actual_points.keys()) + target_indices
    seen = set()
    points: List[Dict[str, object]] = []
    for period_idx in timeline:
        if period_idx in seen:
            continue
        seen.add(period_idx)
        period = period_payload(period_idx)
        actual_value = actual_points.get(period_idx)
        forecast_value = forecast_points.get(period_idx)
        if actual_value is not None:
            points.append(
                {
                    **period,
                    "value": actual_value,
                    "lower": None,
                    "upper": None,
                    "is_forecast": False,
                }
            )
            continue
        if forecast_value is not None:
            points.append(
                {
                    **period,
                    "value": forecast_value.value,
                    "lower": forecast_value.lower,
                    "upper": forecast_value.upper,
                    "is_forecast": True,
                }
            )
    return points


def _peer_median_points(
    metric_id: str,
    peer_metric_maps: Dict[str, Dict[str, Dict[str, object]]],
    timeline_indices: List[int],
    target_indices: List[int],
) -> List[Dict[str, object]]:
    future_index_set = set(target_indices)
    points: List[Dict[str, object]] = []
    for period_idx in timeline_indices:
        values: List[float] = []
        for bank_maps in peer_metric_maps.values():
            metric_map = bank_maps.get(metric_id)
            if not metric_map:
                continue
            actual_points: Dict[int, float] = metric_map["actual_points"]  # type: ignore[assignment]
            forecast_points: Dict[int, ForecastPoint] = metric_map["forecast_points"]  # type: ignore[assignment]
            if period_idx in actual_points:
                values.append(actual_points[period_idx])
            elif period_idx in forecast_points:
                values.append(forecast_points[period_idx].value)
        if not values:
            continue
        points.append(
            {
                **period_payload(period_idx),
                "value": median(values),
                "lower": None,
                "upper": None,
                "is_forecast": period_idx in future_index_set,
            }
        )
    return points


def _peer_rankings(
    metric_id: str,
    primary_bank_id: str,
    bank_metric_maps: Dict[str, Dict[str, Dict[str, object]]],
    target_indices: List[int],
) -> List[Dict[str, object]]:
    projection_index = target_indices[-1]
    rankings: List[Dict[str, object]] = []
    for bank_id, metric_maps in bank_metric_maps.items():
        metric_map = metric_maps[metric_id]
        actual_points: Dict[int, float] = metric_map["actual_points"]  # type: ignore[assignment]
        forecast_points: Dict[int, ForecastPoint] = metric_map["forecast_points"]  # type: ignore[assignment]
        latest_actual = actual_points[max(actual_points)] if actual_points else None
        projected_point = forecast_points.get(projection_index)
        projected_value = projected_point.value if projected_point else None
        if latest_actual is not None and projected_value is not None and latest_actual != 0:
            change_pct = ((projected_value - latest_actual) / abs(latest_actual)) * 100.0
        else:
            change_pct = None
        rankings.append(
            {
                "bank_id": bank_id,
                "rank": 0,
                "latest_actual": latest_actual,
                "projected_value": projected_value,
                "change_pct": change_pct,
                "status": metric_map["status"],
                "unavailable_reason": metric_map["unavailable_reason"],
                "is_primary": bank_id == primary_bank_id,
            }
        )

    available = [entry for entry in rankings if entry["projected_value"] is not None]
    unavailable = [entry for entry in rankings if entry["projected_value"] is None]
    available.sort(key=lambda entry: float(entry["projected_value"]), reverse=True)
    unavailable.sort(key=lambda entry: entry["bank_id"])

    ordered = [*available, *unavailable]
    for rank, entry in enumerate(ordered, start=1):
        entry["rank"] = rank
        entry.pop("is_primary", None)
    return ordered


def _summary_cards(
    primary_merged_period_values: Dict[int, Dict[str, float]],
    latest_primary_period_index: int,
    target_indices: List[int],
) -> List[Dict[str, object]]:
    cards: List[Dict[str, object]] = []
    previous_deposits = primary_merged_period_values.get(latest_primary_period_index, {}).get("deposits")
    previous_loans = primary_merged_period_values.get(latest_primary_period_index, {}).get("loans_outstanding")

    for offset, target_index in enumerate(target_indices, start=1):
        values = primary_merged_period_values.get(target_index, {})
        deposits = values.get("deposits")
        loans = values.get("loans_outstanding")
        net_profit = values.get("net_profit")
        loan_to_deposit = _derived_value("loan_to_deposit_ratio", values)

        deposit_growth_pct = None
        loan_growth_pct = None
        if previous_deposits not in (None, 0) and deposits is not None:
            deposit_growth_pct = ((deposits - previous_deposits) / abs(previous_deposits)) * 100.0
        if previous_loans not in (None, 0) and loans is not None:
            loan_growth_pct = ((loans - previous_loans) / abs(previous_loans)) * 100.0

        available_values = [deposit_growth_pct, loan_growth_pct, net_profit, loan_to_deposit]
        available_count = sum(value is not None for value in available_values)
        if available_count == len(available_values):
            status = "ready"
        elif available_count > 0:
            status = "partial"
        else:
            status = "unavailable"

        cards.append(
            {
                **period_payload(target_index, relative_label=f"Q+{offset}"),
                "quarter_label": f"Q+{offset}",
                "period_label": f"{index_to_period(target_index)[0]} Q{index_to_period(target_index)[1]}",
                "deposit_growth_pct": deposit_growth_pct,
                "loan_growth_pct": loan_growth_pct,
                "net_profit": net_profit,
                "loan_to_deposit_ratio": loan_to_deposit,
                "status": status,
            }
        )

        if deposits is not None:
            previous_deposits = deposits
        if loans is not None:
            previous_loans = loans

    return cards


def build_forecast_response(
    rows: Iterable[object],
    primary_bank_id: str,
    peer_bank_ids: List[str],
    horizon_quarters: int,
) -> Dict[str, object]:
    bank_period_maps = build_bank_period_maps(rows)
    primary_period_values = bank_period_maps.get(primary_bank_id, {})
    latest_primary_period_index = max(primary_period_values) if primary_period_values else None

    if latest_primary_period_index is None:
        target_indices: List[int] = []
    else:
        clamped_horizon = max(1, min(int(horizon_quarters or MAX_FORECAST_HORIZON), MAX_FORECAST_HORIZON))
        target_indices = [latest_primary_period_index + offset for offset in range(1, clamped_horizon + 1)]

    bank_metric_maps: Dict[str, Dict[str, Dict[str, object]]] = {}
    bank_merged_period_values: Dict[str, Dict[int, Dict[str, float]]] = {}
    for bank_id in [primary_bank_id, *peer_bank_ids]:
        metric_maps, merged_period_values = _bank_metric_maps_for_response(
            bank_id,
            bank_period_maps.get(bank_id, {}),
            target_indices,
        )
        bank_metric_maps[bank_id] = metric_maps
        bank_merged_period_values[bank_id] = merged_period_values

    history_periods = [period_payload(idx) for idx in sorted(primary_period_values)]
    forecast_periods = [
        period_payload(target_index, relative_label=f"Q+{offset}")
        for offset, target_index in enumerate(target_indices, start=1)
    ]

    metric_series: List[Dict[str, object]] = []
    unavailable_metrics: List[Dict[str, object]] = []
    for metric in METRIC_DEFINITIONS:
        primary_metric_map = bank_metric_maps[primary_bank_id][metric.id]
        primary_points = _series_points(primary_metric_map, target_indices)
        timeline_indices = [period_index(point["year"], point["quarter"]) for point in primary_points]
        peer_points = _peer_median_points(
            metric.id,
            {bank_id: bank_metric_maps[bank_id] for bank_id in peer_bank_ids},
            timeline_indices,
            target_indices,
        ) if timeline_indices else []
        rankings = _peer_rankings(metric.id, primary_bank_id, bank_metric_maps, target_indices) if target_indices else []

        metric_series.append(
            {
                "metric_id": metric.id,
                "label": metric.label,
                "format": metric.format,
                "status": primary_metric_map["status"],
                "unavailable_reason": primary_metric_map["unavailable_reason"],
                "primary_points": primary_points,
                "peer_median_points": peer_points,
                "peer_rankings": rankings,
            }
        )

        if primary_metric_map["status"] != "ready":
            unavailable_metrics.append(
                {
                    "bank_id": primary_bank_id,
                    "metric_id": metric.id,
                    "label": metric.label,
                    "reason": primary_metric_map["unavailable_reason"] or "Forecast is not available for this metric.",
                }
            )
        for peer_bank_id in peer_bank_ids:
            peer_metric_map = bank_metric_maps[peer_bank_id][metric.id]
            if peer_metric_map["status"] == "ready":
                continue
            unavailable_metrics.append(
                {
                    "bank_id": peer_bank_id,
                    "metric_id": metric.id,
                    "label": metric.label,
                    "reason": peer_metric_map["unavailable_reason"] or "Forecast is not available for this metric.",
                }
            )

    summary_cards = (
        _summary_cards(bank_merged_period_values[primary_bank_id], latest_primary_period_index, target_indices)
        if latest_primary_period_index is not None
        else []
    )

    return {
        "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "primary_bank_id": primary_bank_id,
        "peer_bank_ids": peer_bank_ids,
        "history_periods": history_periods,
        "forecast_periods": forecast_periods,
        "summary_cards": summary_cards,
        "metric_series": metric_series,
        "unavailable_metrics": unavailable_metrics,
    }
