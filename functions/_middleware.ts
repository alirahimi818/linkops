export const onRequest: PagesFunction = async (ctx) => {
  const { request, env } = ctx;

  const origin = request.headers.get("Origin"); // Note: can be null for same-origin or non-browser

  // Configure allowed origins via env (recommended)
  const allowed = String((env as any).ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const isAllowedOrigin = origin ? allowed.includes(origin) : false;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    // If no Origin header, it's not a browser CORS preflight; reply minimally
    if (!origin) return new Response(null, { status: 204 });

    if (!isAllowedOrigin) {
      return new Response(null, { status: 403 });
    }

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

  // Only attach CORS headers when it is a cross-origin browser request AND allowed
  if (origin && isAllowedOrigin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  }

  // Security headers
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );

  // CSP (keep yours, but consider dev needs if you load from localhost)
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
    ].join("; ")
  );

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};
