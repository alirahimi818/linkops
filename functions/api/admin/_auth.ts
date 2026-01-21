export type EnvAuth = {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_TTL_SECONDS?: string;
};

function base64urlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlEncodeString(s: string): string {
  return base64urlEncode(new TextEncoder().encode(s));
}

function base64urlDecodeToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64urlDecodeToString(s: string): string {
  return new TextDecoder().decode(base64urlDecodeToBytes(s));
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64urlEncode(new Uint8Array(sig));
}

export async function signJwt(env: EnvAuth, payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const ttl = Number(env.JWT_TTL_SECONDS ?? "604800");
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = { ...payload, iat: now, exp: now + ttl };

  const h = base64urlEncodeString(JSON.stringify(header));
  const p = base64urlEncodeString(JSON.stringify(fullPayload));
  const toSign = `${h}.${p}`;
  const s = await hmacSha256(env.JWT_SECRET, toSign);
  return `${toSign}.${s}`;
}

export async function verifyJwt(env: EnvAuth, token: string): Promise<any | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  const toSign = `${h}.${p}`;
  const expected = await hmacSha256(env.JWT_SECRET, toSign);
  if (expected !== s) return null;

  const payload = JSON.parse(base64urlDecodeToString(p));
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return null;

  return payload;
}

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Password hashing (PBKDF2-SHA256)
 * Stored format: pbkdf2$<iterations>$<salt_b64url>$<hash_b64url>
 */
export async function hashPassword(password: string): Promise<string> {
  const iterations = 150000;
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );

  const hash = new Uint8Array(bits);
  return `pbkdf2$${iterations}$${base64urlEncode(salt)}$${base64urlEncode(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const m = stored.match(/^pbkdf2\$(\d+)\$([A-Za-z0-9\-_]+)\$([A-Za-z0-9\-_]+)$/);
  if (!m) return false;

  const iterations = Number(m[1]);
  const saltB64 = m[2];
  const hashB64 = m[3];

  const salt = base64urlDecodeToBytes(saltB64);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );

  const computed = base64urlEncode(new Uint8Array(bits));
  return computed === hashB64;
}

export type AuthedUser = { id: string; username: string; role: string; email?: string | null };

export async function requireAuth(env: EnvAuth, req: Request): Promise<AuthedUser | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const payload = await verifyJwt(env, token);
  if (!payload?.sub || !payload?.username || !payload?.role) return null;

  return {
    id: String(payload.sub),
    username: String(payload.username),
    role: String(payload.role),
    email: payload.email ? String(payload.email) : null,
  };
}

export function requireRole(user: AuthedUser, allowed: string[]): boolean {
  return allowed.includes(user.role);
}
