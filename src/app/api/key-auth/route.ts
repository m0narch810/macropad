import { NextResponse, type NextRequest } from "next/server";

const ACCESS_KEY = "yyy-alg000";
const COOKIE_NAME = "trifekta_key";

export async function POST(request: NextRequest) {
  const { key } = await request.json().catch(() => ({ key: "" }));

  if (key !== ACCESS_KEY) {
    return NextResponse.json({ ok: false, error: "invalid_key" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, ACCESS_KEY, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
