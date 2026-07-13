import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/app"];
const AUTH_PAGES = ["/signin"];
const ACCESS_KEY = "yyy-alg000";
const COOKIE_NAME = "trifekta_key";

export default function proxy(request: NextRequest) {
  const hasAccess = request.cookies.get(COOKIE_NAME)?.value === ACCESS_KEY;

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.some((p) => path === p);

  if (isProtected && !hasAccess) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && hasAccess) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/refresh).*)"],
};
