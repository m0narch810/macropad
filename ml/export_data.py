"""
Pulls every row of macro_series (all indicators + market tickers, full
history and payload) from Supabase and caches it locally as JSON, so the
rest of the ML pipeline doesn't hit the network repeatedly.

Reads Supabase URL/anon key from ../.env.local (same file the Next.js app
uses) so there's exactly one place credentials live.
"""

import json
import os
import re
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def load_env_local() -> dict[str, str]:
    env_path = ROOT / ".env.local"
    env: dict[str, str] = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip()
    return env


def fetch_all_rows(base_url: str, anon_key: str) -> list[dict]:
    url = f"{base_url}/rest/v1/macro_series"
    headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
    params = {
        "select": "id,panel_id,name,note,value,status,zscore,history,payload,window_label,updated_at",
    }
    res = requests.get(url, headers=headers, params=params, timeout=60)
    res.raise_for_status()
    return res.json()


def main() -> None:
    env = load_env_local()
    base_url = env["NEXT_PUBLIC_SUPABASE_URL"]
    anon_key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

    rows = fetch_all_rows(base_url, anon_key)
    print(f"fetched {len(rows)} rows")

    out_path = DATA_DIR / "macro_series.json"
    out_path.write_text(json.dumps(rows, indent=None))
    print(f"wrote {out_path}")

    with_history = [r for r in rows if r.get("history")]
    print(f"{len(with_history)} rows have non-empty history")
    for r in sorted(with_history, key=lambda r: r["id"]):
        n = len(r["history"])
        print(f"  {r['id']:40s} n={n:4d}  panel={r['panel_id']}")


if __name__ == "__main__":
    main()
