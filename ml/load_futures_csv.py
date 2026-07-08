"""
Resamples the 1-minute ES/NQ continuous-futures CSVs (semicolon-delimited,
European number format e.g. "1.837,75" = 1837.75) down to daily and weekly
close series, so the RFR backtest can use ~12 years of real futures data
instead of the 2-year Yahoo index proxy.

Source files (not in the repo — local only):
  C:/Users/kirti/Desktop/claudebt/levels_testing/1Min_ES.csv
  C:/Users/kirti/Desktop/claudebt/levels_testing/1Min_NQ.csv

Output: ml/data/{es,nq}_{daily,weekly}.csv  (date,close)
"""

from pathlib import Path

import pandas as pd

SOURCES = {
    "es": Path("C:/Users/kirti/Desktop/claudebt/levels_testing/1Min_ES.csv"),
    "nq": Path("C:/Users/kirti/Desktop/claudebt/levels_testing/1Min_NQ.csv"),
}

OUT_DIR = Path(__file__).resolve().parent / "data"
OUT_DIR.mkdir(exist_ok=True)


def parse_euro_number(series: pd.Series) -> pd.Series:
    # "1.837,75" -> remove thousands "." -> "1837,75" -> "," to "." -> 1837.75
    return (
        series.astype(str)
        .str.replace(".", "", regex=False)
        .str.replace(",", ".", regex=False)
        .astype(float)
    )


def load_and_resample(path: Path) -> tuple[pd.Series, pd.Series]:
    print(f"reading {path} ({path.stat().st_size / 1e6:.0f} MB)...")
    df = pd.read_csv(
        path,
        sep=";",
        usecols=["Date", "Close"],
        dtype={"Close": str},
        engine="c",
    )
    print(f"  {len(df):,} rows")
    df["Date"] = pd.to_datetime(df["Date"], format="%m/%d/%Y %I:%M %p")
    df["Close"] = parse_euro_number(df["Close"])
    df = df.set_index("Date").sort_index()

    daily = df["Close"].resample("1D").last().dropna()
    weekly = df["Close"].resample("1W-FRI").last().dropna()
    print(f"  daily bars: {len(daily)}  ({daily.index[0].date()} -> {daily.index[-1].date()})")
    print(f"  weekly bars: {len(weekly)}  ({weekly.index[0].date()} -> {weekly.index[-1].date()})")
    return daily, weekly


def write_series(name: str, s: pd.Series) -> None:
    out = pd.DataFrame({"date": s.index.strftime("%Y-%m-%d"), "value": s.values})
    path = OUT_DIR / f"{name}.csv"
    out.to_csv(path, index=False)
    print(f"wrote {path} ({len(out)} rows)")


def main() -> None:
    for key, path in SOURCES.items():
        if not path.exists():
            print(f"MISSING: {path}")
            continue
        daily, weekly = load_and_resample(path)
        write_series(f"{key}_daily", daily)
        write_series(f"{key}_weekly", weekly)


if __name__ == "__main__":
    main()
