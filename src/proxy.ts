import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const teacherRoutes = ["/teacher"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if accessing teacher routes
  const isTeacherRoute = teacherRoutes.some((route) => pathname.startsWith(route));

  if (isTeacherRoute) {
    // For teacher auth verification, we rely on client-side auth state
    // The teacher login page itself is accessible
    // Protected teacher pages check auth client-side
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
