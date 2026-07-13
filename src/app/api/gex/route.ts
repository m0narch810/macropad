import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_SYMBOLS = new Set(["QQQ", "SPX"]);

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!ALLOWED_SYMBOLS.has(symbol)) {
    return NextResponse.json({ ok: false, error: "unsupported_symbol" }, { status: 400 });
  }

  const base = process.env.GEX_API_BASE;
  const key = process.env.GEX_API_KEY;
  if (!base || !key) {
    return NextResponse.json({ ok: false, error: "gex_api_not_configured" }, { status: 500 });
  }

  const upstream = await fetch(`${base}/greeks?symbol=${symbol}&key=${key}`, {
    headers: { "bypass-tunnel-reminder": "true" },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json({ ok: false, error: "upstream_error", status: upstream.status }, { status: 502 });
  }

  const data = await upstream.json();
  return NextResponse.json(data);
}
