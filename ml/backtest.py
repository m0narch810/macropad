"""
RandomForestRegressor backtest for ES (^GSPC proxy) and NQ (^IXIC proxy),
daily and weekly horizons, using EVERY indicator in the dataset as a
feature (not just the ones IMPACTS links to that asset today) — the whole
point is to let the model tell us which indicators actually matter instead
of us guessing up front.

No-lookahead: every feature value used to predict date T is the latest
value of that indicator known ON OR BEFORE T (merge_asof, backward direction).
Hyperparameters are tuned only on an early "tune" slice of the timeline;
the walk-forward backtest never lets a future date influence a tuning
decision or a training fold that predicts an earlier date.

Usage: python ml/backtest.py
"""

from __future__ import annotations

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline

warnings.filterwarnings("ignore")

DATA_DIR = Path(__file__).resolve().parent / "data"
OUT_DIR = Path(__file__).resolve().parent / "results"
OUT_DIR.mkdir(exist_ok=True)

ASSETS = {"ES": "market:^GSPC", "NQ": "market:^IXIC"}
HORIZON_TRADING_DAYS = {"daily": 1, "weekly": 5}

# Fixed NUMBER of retrains across the whole backtest window (step size is
# derived from this), not a fixed day-count step — this box's per-fit cost
# is too unpredictable/slow to hardcode a day-step and hit a time budget.
NUM_RETRAINS = 8

TUNE_FRACTION = 0.55  # earliest 55% of the timeline is tune-only, never backtested on


def load_rows() -> list[dict]:
    return json.loads((DATA_DIR / "macro_series.json").read_text())


def series_to_df(history: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(history)
    # Some series store plain "YYYY-MM-DD" dates, others full ISO timestamps
    # with a timezone (news pubDate) — normalize everything to tz-naive so
    # merge_asof never sees a dtype mismatch between two indicator series.
    df["date"] = pd.to_datetime(df["date"], utc=True).dt.tz_localize(None)
    df = df.sort_values("date").drop_duplicates("date")
    return df.set_index("date")["value"]


def build_feature_frame(rows: list[dict], target_dates: pd.DatetimeIndex, exclude_ids: set[str]) -> pd.DataFrame:
    """
    For every non-market indicator (all of them — this is the point), as-of
    join its latest known value onto `target_dates`, plus a "staleness"
    column (days since that value was actually printed) so the model can
    learn that a 3-day-old daily print carries more information than a
    75-day-old monthly one.
    """
    feature_cols: dict[str, pd.Series] = {}
    staleness_cols: dict[str, pd.Series] = {}

    for row in rows:
        rid = row["id"]
        if rid in exclude_ids:
            continue
        if row["panel_id"] == "market":
            continue  # only indicators are features; asset prices/other tickers are not
        history = row.get("history")
        if not history or len(history) < 10:
            continue

        s = series_to_df(history)
        target_df = pd.DataFrame(index=target_dates)
        src_df = pd.DataFrame({"value": s.values, "src_date": s.index}, index=s.index)

        merged = pd.merge_asof(
            target_df.reset_index().rename(columns={"index": "date"}),
            src_df.reset_index(drop=True).sort_values("src_date"),
            left_on="date",
            right_on="src_date",
            direction="backward",
        )
        feature_cols[rid] = pd.Series(merged["value"].values, index=target_dates)
        staleness_cols[f"{rid}__stale_days"] = pd.Series(
            (merged["date"] - merged["src_date"]).dt.days.values, index=target_dates
        )

    feat = pd.DataFrame(feature_cols)
    stale = pd.DataFrame(staleness_cols)
    return pd.concat([feat, stale], axis=1)


def build_targets(daily_prices: pd.Series, horizon_days: int) -> pd.Series:
    fwd = daily_prices.shift(-horizon_days)
    return (fwd - daily_prices) / daily_prices * 100.0


def hyperparam_search(X: pd.DataFrame, y: pd.Series) -> dict:
    pipe = Pipeline(
        [
            ("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
            ("rfr", RandomForestRegressor(random_state=42, n_jobs=1)),
        ]
    )
    param_dist = {
        "rfr__n_estimators": [60, 100, 150],
        "rfr__max_depth": [3, 4, 5],
        "rfr__min_samples_leaf": [8, 15, 25],
        "rfr__max_features": ["sqrt", "log2", 0.3],
    }
    tscv = TimeSeriesSplit(n_splits=2)
    search = RandomizedSearchCV(
        pipe,
        param_distributions=param_dist,
        n_iter=6,
        cv=tscv,
        scoring="neg_mean_absolute_error",
        random_state=42,
        n_jobs=1,
    )
    search.fit(X, y)
    return search.best_params_


def walk_forward_backtest(X: pd.DataFrame, y: pd.Series, best_params: dict, horizon_key: str) -> dict:
    # Plain numpy arrays for the loop — repeated .iloc on a DataFrame with a
    # DatetimeIndex is measurably slower than array slicing at this row count.
    dates_all = [str(d.date()) for d in X.index]
    X_np = X.to_numpy()
    y_np = y.to_numpy()
    feature_names = list(X.columns)

    n = len(X_np)
    tune_end = int(n * TUNE_FRACTION)
    step = max(20, (n - tune_end) // NUM_RETRAINS)

    rfr_params = {k.replace("rfr__", ""): v for k, v in best_params.items()}
    preds: list[float] = []
    actuals: list[float] = []
    dates: list[str] = []
    importances_accum = np.zeros(X_np.shape[1])
    n_fits = 0

    model = None
    current_imputer = None
    for i in range(tune_end, n):
        if model is None or (i - tune_end) % step == 0:
            imputer = SimpleImputer(strategy="median", keep_empty_features=True)
            X_train_imp = imputer.fit_transform(X_np[:i])
            model = RandomForestRegressor(random_state=42, n_jobs=1, **rfr_params)
            model.fit(X_train_imp, y_np[:i])
            importances_accum += model.feature_importances_
            n_fits += 1
            current_imputer = imputer
            print(f"  retrain {n_fits} at row {i}/{n}", flush=True)

        x_row = current_imputer.transform(X_np[i : i + 1])
        pred = model.predict(x_row)[0]
        preds.append(pred)
        actuals.append(y_np[i])
        dates.append(dates_all[i])

    preds_arr = np.array(preds)
    actuals_arr = np.array(actuals)

    valid = ~np.isnan(actuals_arr)
    preds_v = preds_arr[valid]
    actuals_v = actuals_arr[valid]

    hit_mask = np.abs(preds_v) > np.percentile(np.abs(preds_v), 40)  # meaningful-magnitude predictions only
    hit_rate = float(np.mean(np.sign(preds_v[hit_mask]) == np.sign(actuals_v[hit_mask]))) if hit_mask.sum() > 5 else None
    hit_rate_all = float(np.mean(np.sign(preds_v) == np.sign(actuals_v)))
    corr = float(np.corrcoef(preds_v, actuals_v)[0, 1]) if len(preds_v) > 5 else None

    bullish = actuals_v[preds_v > np.percentile(preds_v, 70)]
    bearish = actuals_v[preds_v < np.percentile(preds_v, 30)]

    avg_importances = importances_accum / max(1, n_fits)
    top_features = sorted(zip(X.columns, avg_importances), key=lambda t: -t[1])[:25]

    return {
        "n_predictions": int(len(preds_v)),
        "n_retrains": n_fits,
        "correlation_pred_vs_actual": corr,
        "hit_rate_all": hit_rate_all,
        "hit_rate_top60pct_magnitude": hit_rate,
        "avg_forward_return_when_bullish_pct": float(np.mean(bullish)) if len(bullish) else None,
        "avg_forward_return_when_bearish_pct": float(np.mean(bearish)) if len(bearish) else None,
        "best_params": rfr_params,
        "top_features": [{"feature": f, "importance": float(v)} for f, v in top_features],
        "dates_backtested": [dates[0], dates[-1]] if dates else None,
    }


def load_local_price_csv(asset_key: str) -> pd.Series | None:
    """12y ES/NQ daily closes resampled from the 1-min futures files (see load_futures_csv.py), if present."""
    path = DATA_DIR / f"{asset_key.lower()}_daily.csv"
    if not path.exists():
        return None
    df = pd.read_csv(path, parse_dates=["date"])
    return df.set_index("date")["value"].sort_index()


def run(asset_key: str, market_id: str, rows: list[dict]) -> None:
    local_price = load_local_price_csv(asset_key)
    if local_price is not None:
        print(f"[{asset_key}] using local 12y futures daily closes ({len(local_price)} bars, {local_price.index[0].date()} -> {local_price.index[-1].date()})")
        price = local_price
    else:
        market_row = next(r for r in rows if r["id"] == market_id)
        daily_hist = (market_row.get("payload") or {}).get("dailyHistory") or []
        if len(daily_hist) < 60:
            print(f"[{asset_key}] not enough daily history ({len(daily_hist)}), skipping")
            return
        print(f"[{asset_key}] using Supabase Yahoo dailyHistory ({len(daily_hist)} bars)")
        price = series_to_df(daily_hist)

    exclude = {market_id}

    for horizon_key, hdays in HORIZON_TRADING_DAYS.items():
        print(f"\n=== {asset_key} / {horizon_key} ===")
        X = build_feature_frame(rows, price.index, exclude)
        y = build_targets(price, hdays)

        combined = pd.concat([X, y.rename("target")], axis=1).dropna(subset=["target"])
        X_use = combined.drop(columns=["target"])
        y_use = combined["target"]

        print(f"rows={len(X_use)}  features={X_use.shape[1]}")

        tune_end = int(len(X_use) * TUNE_FRACTION)
        best_params = hyperparam_search(X_use.iloc[:tune_end], y_use.iloc[:tune_end])
        print("best params:", best_params)

        result = walk_forward_backtest(X_use, y_use, best_params, horizon_key)
        result["asset"] = asset_key
        result["horizon"] = horizon_key
        result["n_features_total"] = int(X_use.shape[1])

        print(json.dumps({k: v for k, v in result.items() if k != "top_features"}, indent=2))
        print("top 10 features:")
        for f in result["top_features"][:10]:
            print(f"  {f['feature']:45s} {f['importance']:.4f}")

        out_path = OUT_DIR / f"{asset_key.lower()}_{horizon_key}.json"
        out_path.write_text(json.dumps(result, indent=2))
        print(f"wrote {out_path}")


def main() -> None:
    rows = load_rows()
    for asset_key, market_id in ASSETS.items():
        run(asset_key, market_id, rows)


if __name__ == "__main__":
    main()
