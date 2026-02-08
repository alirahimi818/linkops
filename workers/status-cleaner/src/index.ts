export interface Env {
  DB: D1Database;
  STATUS_RETENTION_DAYS?: string;
}

function yyyymmdd(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function parseRetentionDays(v: string | undefined): number {
  const n = Number(v ?? "90");
  if (!Number.isFinite(n) || n < 1) return 90;
  // Safety cap to avoid mistakes like 999999
  return Math.min(Math.floor(n), 3650);
}

async function deleteBatch(env: Env, cutoff: string, limit: number): Promise<number> {
  const res = await env.DB.prepare(
    `
    DELETE FROM item_status
    WHERE rowid IN (
      SELECT s.rowid
      FROM item_status s
      JOIN items i ON i.id = s.item_id
      WHERE i.is_global = 0
        AND i.date < ?
      LIMIT ?
    )
    `
  )
    .bind(cutoff, limit)
    .run();

  // D1 returns "meta.changes"
  return Number((res as any)?.meta?.changes ?? 0);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const retentionDays = parseRetentionDays(env.STATUS_RETENTION_DAYS);
    const now = new Date();
    const cutoff = yyyymmdd(addDaysUTC(now, -retentionDays));

    const BATCH = 5000;
    const MAX_LOOPS = 50; // 50 * 5000 = 250k rows max per run (safe guard)

    let totalDeleted = 0;

    for (let i = 0; i < MAX_LOOPS; i++) {
      const deleted = await deleteBatch(env, cutoff, BATCH);
      totalDeleted += deleted;

      if (deleted === 0) break;
    }

    // Optional: log (visible in Workers logs)
    console.log(
      JSON.stringify({
        ok: true,
        cutoff,
        retentionDays,
        totalDeleted,
      })
    );
  },
};
