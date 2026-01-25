import type { Category } from "./api";

export type ItemComment = { id: string; text: string; created_at: string };

export function mapItemCommentsToStrings(c: any): string[] {
  if (!c) return [];
  if (Array.isArray(c) && c.length > 0 && typeof c[0] === "string") return c;
  if (Array.isArray(c)) return (c as ItemComment[]).map((x) => x.text);
  return [];
}

export function normalizeHost(inputUrl: string): string | null {
  try {
    const u = new URL(inputUrl.trim());
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function autoFixUrl(inputUrl: string): string {
  const raw = (inputUrl ?? "").trim();
  if (!raw) return raw;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `https://${raw}`;
}

export function isValidAbsoluteHttpUrl(inputUrl: string): boolean {
  try {
    const u = new URL(inputUrl.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeCategoryName(input: string): string {
  return (input ?? "").trim().toLowerCase();
}

function matchPlatformByHost(host: string): "x" | "instagram" | null {
  const h = host.replace(/^www\./, "");

  if (
    h === "x.com" ||
    h.endsWith(".x.com") ||
    h === "twitter.com" ||
    h.endsWith(".twitter.com") ||
    h === "t.co" ||
    h.endsWith(".t.co")
  ) {
    return "x";
  }

  if (
    h === "instagram.com" ||
    h.endsWith(".instagram.com") ||
    h === "instagr.am" ||
    h.endsWith(".instagr.am")
  ) {
    return "instagram";
  }

  return null;
}

function findCategoryIdForPlatform(categories: Category[], platform: "x" | "instagram"): string | null {
  const names = categories.map((c) => ({
    id: (c as any).id as string,
    name: normalizeCategoryName((c as any).name as string),
    raw: ((c as any).name as string) ?? "",
  }));

  if (platform === "x") {
    const exact = names.find((c) => c.raw.trim() === "X (توییتر)");
    if (exact) return exact.id;

    const containsPersian = names.find((c) => c.name.includes("توییتر"));
    if (containsPersian) return containsPersian.id;

    const containsTwitter = names.find((c) => c.name.includes("twitter"));
    if (containsTwitter) return containsTwitter.id;

    const containsX = names.find((c) => c.name === "x" || c.name.includes(" x "));
    if (containsX) return containsX.id;

    return null;
  }

  const exact = names.find((c) => c.raw.trim() === "اینستاگرام");
  if (exact) return exact.id;

  const containsPersian = names.find((c) => c.name.includes("اینستاگرام") || c.name.includes("اینستا"));
  if (containsPersian) return containsPersian.id;

  const containsInstagram = names.find((c) => c.name.includes("instagram"));
  if (containsInstagram) return containsInstagram.id;

  return null;
}

export function autoCategoryIdFromUrl(categories: Category[], nextUrlRaw: string): string | null {
  const fixed = autoFixUrl(nextUrlRaw);
  const host = normalizeHost(fixed);
  if (!host) return null;

  const platform = matchPlatformByHost(host);
  if (!platform) return null;

  return findCategoryIdForPlatform(categories, platform);
}