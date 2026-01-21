export function todayYYYYMMDD(): string {
  return formatYYYYMMDD(new Date());
}

export function formatYYYYMMDD(d: Date): string {
  // Always returns YYYY-MM-DD
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${y}-${m}-${day}`;
}

export function addDaysYYYYMMDD(dateYYYYMMDD: string, deltaDays: number): string {
  const [y, m, d] = dateYYYYMMDD.split("-").map(Number);

  // Use UTC base to avoid local timezone drift issues
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + deltaDays);

  return formatYYYYMMDD(base);
}
