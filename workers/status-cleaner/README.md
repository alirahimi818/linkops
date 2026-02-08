# Status Cleaner Worker

Scheduled Cloudflare Worker to clean up item_status table.

- Deletes status rows for non-global items
- Based on items.date < (today - STATUS_RETENTION_DAYS)
- Runs daily via cron

Env:
- STATUS_RETENTION_DAYS (default: 90)
