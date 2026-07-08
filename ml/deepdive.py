"""
Deeper pass on top of backtest.py's weekly result (the horizon that showed
a real edge): richer features (adds period-over-period CHANGE, not just
level+staleness), a top-K feature-selected variant, and a gradient-boosting
comparison — to see if any of these actually beat the plain RandomForest
baseline instead of just adding complexity.

Usage: python ml/deepdive.py
"""

from __future__ import annotations

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer

from backtest import (
    ASSETS,
    DATA_DIR,
    NUM_RETRAINS,
    TUNE_FRACTION,
    build_targets,
    hyperparam_search,
    load_local_price_csv,
    load_rows,
    series_to_df,
)

warnings.filterwarnings("ignore")

OUT_DIR = Path(__file__).resolve().parent / "results"
HORIZON_DAYS = 5  # weekly only for this pass


def build_feature_frame_with_diff(rows: list[dict], target_dates: pd.DatetimeIndex, exclude_ids: set[str]) -> pd.DataFrame:
    """Same as backtest.build_feature_frame, plus a `__chg` column: the
    indicator's change from its previous print to its latest known print
    (in its own units) — captures "did this just move" vs. "where does it sit"."""
    cols: dict[str, pd.Series] = {}

    for row in rows:
        rid = row["id"]
        if rid in exclude_ids or row["panel_id"] == "market":
            continue
        history = row.get("history")
        if not history or len(history) < 10:
            continue

        s = series_to_df(history)
        chg = s.diff()

        target_df = pd.DataFrame(index=target_dates).reset_index().rename(columns={"index": "date"})
        src_df = pd.DataFrame({"value": s.values, "chg": chg.values, "src_date": s.index}).sort_values("src_date")

        merged = pd.merge_asof(target_df, src_df, left_on="date", right_on="src_date", direction="backward")
        cols[rid] = pd.Series(merged["value"].values, index=target_dates)
        cols[f"{rid}__chg"] = pd.Series(merged["chg"].values, index=target_dates)
        cols[f"{rid}__stale_days"] = pd.Series((merged["date"] - merged["src_date"]).dt.days.values, index=target_dates)

    return pd.DataFrame(cols)


def walk_forward(X: pd.DataFrame, y: pd.Series, model_factory, label: str) -> dict:
    dates_all = [str(d.date()) for d in X.index]
    X_np = X.to_numpy()
    y_np = y.to_numpy()

    n = len(X_np)
    tune_end = int(n * TUNE_FRACTION)
    step = max(20, (n - tune_end) // NUM_RETRAINS)

    preds, actuals, dates = [], [], []
    importances_accum = np.zeros(X_np.shape[1])
    n_fits = 0
    model = None
    current_imputer = None

    for i in range(tune_end, n):
        if model is None or (i - tune_end) % step == 0:
            model = model_factory()
            if isinstance(model, RandomForestRegressor):
                imputer = SimpleImputer(strategy="median", keep_empty_features=True)
                X_train = imputer.fit_transform(X_np[:i])
                current_imputer = imputer
            else:
                X_train = X_np[:i]  # HistGradientBoosting handles NaN natively
                current_imputer = None
            model.fit(X_train, y_np[:i])
            if hasattr(model, "feature_importances_"):
                importances_accum += model.feature_importances_
            n_fits += 1
            print(f"  [{label}] retrain {n_fits} at row {i}/{n}", flush=True)

        x_row = X_np[i : i + 1]
        if current_imputer is not None:
            x_row = current_imputer.transform(x_row)
        preds.append(model.predict(x_row)[0])
        actuals.append(y_np[i])
        dates.append(dates_all[i])

    preds_v = np.array(preds)
    actuals_v = np.array(actuals)
    valid = ~np.isnan(actuals_v)
    preds_v, actuals_v = preds_v[valid], actuals_v[valid]

    hit_mask = np.abs(preds_v) > np.percentile(np.abs(preds_v), 40)
    hit_rate_top = float(np.mean(np.sign(preds_v[hit_mask]) == np.sign(actuals_v[hit_mask]))) if hit_mask.sum() > 5 else None
    hit_rate_all = float(np.mean(np.sign(preds_v) == np.sign(actuals_v)))
    corr = float(np.corrcoef(preds_v, actuals_v)[0, 1]) if len(preds_v) > 5 else None

    avg_importances = importances_accum / max(1, n_fits)
    top_features = sorted(zip(X.columns, avg_importances), key=lambda t: -t[1])[:20]

    return {
        "label": label,
        "n_predictions": int(len(preds_v)),
        "correlation_pred_vs_actual": corr,
        "hit_rate_all": hit_rate_all,
        "hit_rate_top60pct_magnitude": hit_rate_top,
        "top_features": [{"feature": f, "importance": float(v)} for f, v in top_features],
    }


def summarize(result: dict) -> str:
    corr = result["correlation_pred_vs_actual"]
    return (
        f"{result['label']:28s} n={result['n_predictions']:4d}  "
        f"hit_all={result['hit_rate_all']*100:5.1f}%  "
        f"hit_top60={(result['hit_rate_top60pct_magnitude'] or 0)*100:5.1f}%  "
        f"corr={corr:+.3f}" if corr is not None else f"{result['label']:28s} n/a"
    )


def run_asset(asset_key: str, market_id: str, rows: list[dict]) -> list[dict]:
    price = load_local_price_csv(asset_key)
    if price is None:
        print(f"[{asset_key}] no local price file, skipping")
        return []

    exclude = {market_id}
    X = build_feature_frame_with_diff(rows, price.index, exclude)
    y = build_targets(price, HORIZON_DAYS)

    combined = pd.concat([X, y.rename("target")], axis=1).dropna(subset=["target"])
    X_use = combined.drop(columns=["target"])
    y_use = combined["target"]
    print(f"\n[{asset_key}] weekly, level+chg+stale features: rows={len(X_use)} features={X_use.shape[1]}")

    tune_end = int(len(X_use) * TUNE_FRACTION)

    # --- variant 1: RF, full feature set (level + change + staleness) ---
    rf_params = hyperparam_search(X_use.iloc[:tune_end], y_use.iloc[:tune_end])
    rf_params = {k.replace("rfr__", ""): v for k, v in rf_params.items()}
    print(f"[{asset_key}] RF best params: {rf_params}")

    def make_rf():
        return RandomForestRegressor(random_state=42, n_jobs=1, **rf_params)

    result_full = walk_forward(X_use, y_use, make_rf, f"{asset_key} RF full+chg")

    # --- variant 2: RF, top-20 features from variant 1 ---
    top20 = [f["feature"] for f in result_full["top_features"][:20]]
    X_top = X_use[top20]
    result_top20 = walk_forward(X_top, y_use, make_rf, f"{asset_key} RF top20")

    # --- variant 3: HistGradientBoostingRegressor, full feature set ---
    def make_hgb():
        return HistGradientBoostingRegressor(
            random_state=42, max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=20
        )

    result_hgb = walk_forward(X_use, y_use, make_hgb, f"{asset_key} HGB full+chg")

    for r in (result_full, result_top20, result_hgb):
        print(summarize(r))

    return [result_full, result_top20, result_hgb]


def main() -> None:
    rows = load_rows()
    all_results = []
    for asset_key, market_id in ASSETS.items():
        all_results.extend(run_asset(asset_key, market_id, rows))

    print("\n=== SUMMARY (weekly horizon, all variants) ===")
    for r in all_results:
        print(summarize(r))

    out_path = OUT_DIR / "deepdive_weekly.json"
    out_path.write_text(json.dumps(all_results, indent=2))
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
