import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/transitions/:id/(.*)',
  '/api/tasks/(.*)',
  // Both Stage 2 plan pages require auth (a Project is userId-owned, D-034). The
  // anon-accessible Stage 1 view `/transitions/[id]` stays untouched.
  '/transitions/:id/plan(.*)',
]);

const isAnonEligible = createRouteMatcher([
  '/transitions/new',
  '/api/transitions/generate',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  if (isAnonEligible(req)) {
    const { userId } = await auth();
    if (!userId) {
      const existing = req.cookies.get("anon_session")?.value;
      const sessionId = existing ?? crypto.randomUUID();

      // Forward the session ID as a request header so the route handler
      // can read it on this same request — the cookie won't be in
      // req.cookies yet if this is the visitor's first request.
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-anon-session", sessionId);

      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });

      if (!existing) {
        response.cookies.set("anon_session", sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: "/",
        });
      }

      return response;
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/__clerk/(.*)',
    '/(api|trpc)(.*)',
  ],
};