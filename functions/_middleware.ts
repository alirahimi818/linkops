export const onRequest: PagesFunction = async (ctx) => {
  const { request } = ctx;

  const origin = new URL(request.url).origin;

  // CORS: same-origin only (site + API are same host)
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

  // CORS headers
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  // Security headers
  // >= 6 months: 15768000 seconds
  // Use 1 year to satisfy scanners and be future-proof.
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");

  // CSP: allow only self + Cloudflare Insights beacon
  // - script-src allows the beacon JS
  // - connect-src allows sending analytics beacons
  // - img-src may be used by some beacon mechanisms (safe to allow)
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: https://static.cloudflareinsights.com",
      "font-src 'self'",
      "style-src 'self'",
      "script-src 'self' https://static.cloudflareinsights.com",
      "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com",
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
