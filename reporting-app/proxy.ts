import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// These /api routes are called by external Hermes instances using their own
// per-customer bearer-token secret, not a logged-in Clerk session - they must
// stay outside Clerk's auth.protect() or every real sync/read request gets
// rejected before it ever reaches the route's own auth check. /api/inquiries
// and /api/listings/buyer-view are the buyer instance's inbound counterparts
// to /api/ingest and /api/listings/active.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/ingest",
  "/api/listings/active",
  "/api/inquiries",
  "/api/listings/buyer-view",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
