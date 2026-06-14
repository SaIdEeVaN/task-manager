import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-fallback-secret-for-development-only-replace-in-prod"
);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;

  // Verify token
  let isAuthenticated = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // Paths that require authentication
  const isProtectedRoute = pathname === "/" || pathname.startsWith("/api/tasks");

  // Paths that require being unauthenticated (login/register)
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (isProtectedRoute) {
    if (!isAuthenticated) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (isAuthRoute) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

// Config to match our routes
export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/api/tasks/:path*",
  ],
};

export default proxy;
