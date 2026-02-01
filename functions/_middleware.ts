export const onRequest: PagesFunction = async (ctx) => {
  const { request } = ctx;

  const origin = new URL(request.url).origin; // https://together-for-iran.com

  // --- CORS (same-origin) ---
  // Since API + site are same host, keep it strict.
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Vary": "Origin",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const res = await ctx.next();
  const headers = new Headers(res.headers);

  // CORS headers on all responses
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  // --- Security headers ---

  // HSTS: start with 1 day, then increase later
  headers.set("Strict-Transport-Security", "max-age=86400; includeSubDomains");
  // Later (after you're sure): "max-age=15552000; includeSubDomains; preload"

  headers.set("X-Content-Type-Options", "nosniff");

  // Redundant with CSP frame-ancestors, but some scanners still check it
  headers.set("X-Frame-Options", "DENY");

  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  headers.set("Cross-Origin-Resource-Policy", "same-origin");

  // Extra hardening (usually safe)
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");

  // CSP: strict, no external sources
  // If you later need inline scripts/styles, we can switch to nonce-based CSP.
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "style-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  );

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};
