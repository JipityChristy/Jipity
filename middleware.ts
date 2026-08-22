import { NextResponse, type NextRequest } from "next/server";
import { readAuthenticatedState } from "./lib/jipity-security";

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isLoginAction = pathname === "/api/auth/login";

  if (isLoginAction) return addSecurityHeaders(NextResponse.next());

  const state = await readAuthenticatedState(request);

  if (isLoginPage) {
    if (state) {
      return addSecurityHeaders(
        NextResponse.redirect(new URL("/", request.url)),
      );
    }

    return addSecurityHeaders(NextResponse.next());
  }

  if (!state) {
    if (pathname.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: "Private access is required." },
          { status: 401 },
        ),
      );
    }

    return addSecurityHeaders(
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
