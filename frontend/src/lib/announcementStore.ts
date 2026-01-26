const PREFIX = "ann:dismissed:";

function safeKey(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9:_-]/g, "");
}

export function buildAnnouncementKey(scopeKey: string, announcementId: string) {
  return `${PREFIX}${safeKey(scopeKey)}:${safeKey(announcementId)}`;
}

export function isAnnouncementDismissed(scopeKey: string, announcementId: string): boolean {
  try {
    const k = buildAnnouncementKey(scopeKey, announcementId);
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
}

export function dismissAnnouncement(scopeKey: string, announcementId: string) {
  try {
    const k = buildAnnouncementKey(scopeKey, announcementId);
    localStorage.setItem(k, "1");
  } catch {
    // ignore
  }
}

export function resetAnnouncement(scopeKey: string, announcementId: string) {
  try {
    const k = buildAnnouncementKey(scopeKey, announcementId);
    localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
