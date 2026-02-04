export function cleanPastedCommentText(raw: string) {
  let s = String(raw ?? "");

  // Normalize newlines
  s = s.replace(/\r\n?/g, "\n");

  // Remove zero-widths
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Join line breaks before mentions: "\n @POTUS" -> " @POTUS"
  s = s.replace(/\n\s*@/g, " @");

  // Join line breaks around em dash / en dash
  s = s.replace(/\s*\n\s*—\s*/g, " — ");
  s = s.replace(/\s*\n\s*–\s*/g, " – ");

  // Single newlines -> spaces
  s = s.replace(/[ \t]*\n[ \t]*/g, " ");

  // Collapse spaces
  s = s.replace(/[ \t]{2,}/g, " ").trim();

  return s;
}

function findNumberedStart(line: string) {
  const m = line.trim().match(/^(\d{1,3})\s*[.)-]\s+/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return n;
}

function stripNumberedMarker(line: string) {
  return line.replace(/^\s*\d{1,3}\s*[.)-]\s+/, "").trim();
}

function isBulletStart(line: string) {
  return /^(?:[-*•])\s+/.test(line.trim());
}

function stripBulletMarker(line: string) {
  return line.replace(/^\s*(?:[-*•])\s+/, "").trim();
}

/**
 * Extract comments from pasted text.
 * Priority:
 * 1) If numbered items exist (1., 2., ...), extract ONLY those items and ignore any trailing non-item text.
 * 2) Else if bullets exist (-, *, •), extract bullet items.
 * 3) Else return single cleaned block.
 */
export function extractCommentsFromPastedText(raw: string) {
  const input = String(raw ?? "").replace(/\r\n?/g, "\n");
  const lines = input.split("\n");

  // 1) Numbered list mode (strongest signal)
  const hasNumbered = lines.some((l) => findNumberedStart(l) !== null);
  if (hasNumbered) {
    const blocks: string[] = [];
    let cur: string[] = [];
    let started = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const num = findNumberedStart(line);

      if (num !== null) {
        started = true;
        if (cur.length) {
          blocks.push(cur.join("\n"));
          cur = [];
        }
        cur.push(stripNumberedMarker(line));
        continue;
      }

      if (!started) {
        // ignore everything before first numbered item (title/desc/etc)
        continue;
      }

      if (!trimmed) {
        // allow blank lines inside the current item
        if (cur.length) cur.push("");
        continue;
      }

      // If we already have at least one full item and we hit a non-list paragraph
      // AFTER a blank separation, it might be trailing assistant text.
      // We'll handle trailing cut after pushing blocks (below).
      if (cur.length) cur.push(line);
    }

    if (cur.length) blocks.push(cur.join("\n"));

    // Clean blocks
    const cleaned = blocks
      .map((b) => cleanPastedCommentText(b))
      .map((b) => b.replace(/[ \t]{2,}/g, " ").trim())
      .filter(Boolean);

    /**
     * HARD CUT trailing assistant text:
     * If the last cleaned block contains Persian/Arabic characters after the hashtags,
     * we cut anything after the last hashtag chunk or last sentence end.
     */
    if (cleaned.length) {
      const lastIdx = cleaned.length - 1;
      cleaned[lastIdx] = cutTrailingNonCommentText(cleaned[lastIdx]);
    }

    // Also apply cut on all items just in case
    return cleaned.map(cutTrailingNonCommentText).filter(Boolean);
  }

  // 2) Bullet list mode
  const hasBullets = lines.some((l) => isBulletStart(l));
  if (hasBullets) {
    const blocks: string[] = [];
    let cur: string[] = [];
    let started = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (isBulletStart(line)) {
        started = true;
        if (cur.length) {
          blocks.push(cur.join("\n"));
          cur = [];
        }
        cur.push(stripBulletMarker(line));
        continue;
      }

      if (!started) continue;

      if (!trimmed) {
        if (cur.length) cur.push("");
        continue;
      }

      if (cur.length) cur.push(line);
    }

    if (cur.length) blocks.push(cur.join("\n"));

    return blocks
      .map((b) => cleanPastedCommentText(b))
      .map((b) => b.replace(/[ \t]{2,}/g, " ").trim())
      .map(cutTrailingNonCommentText)
      .filter(Boolean);
  }

  // 3) Single block
  const single = cleanPastedCommentText(input);
  return single ? [cutTrailingNonCommentText(single)] : [];
}

/**
 * If Persian/Arabic tail exists (common assistant footer),
 * cut it off safely. Also remove "You can copy..." style footers.
 */
function cutTrailingNonCommentText(s: string) {
  let text = String(s ?? "").trim();
  if (!text) return text;

  // Remove common assistant footer patterns (English)
  text = text.replace(
    /\s*(You can copy.*|Feel free to.*|If you want.*|Let me know.*)$/i,
    "",
  );

  // If Persian/Arabic characters appear, cut from first occurrence
  // ONLY if they appear after we've already had substantial English content.
  const faIdx = text.search(/[\u0600-\u06FF]/);
  if (faIdx > 40) {
    text = text.slice(0, faIdx).trim();
  }

  // If it contains emojis at the end (assistant fluff), trim after last hashtag block
  // Keep up to the last hashtag if any exist
  const lastHash = text.lastIndexOf("#");
  if (lastHash !== -1) {
    // keep until end, but remove any trailing non-hashtag tail after last hashtag token
    // e.g. "#Tag ... فارسی"
    const tail = text.slice(lastHash);
    const m = tail.match(/^#[\p{L}\p{N}_]+(?:\s+#[\p{L}\p{N}_]+)*/u);
    if (m) {
      const keepEnd = lastHash + m[0].length;
      text = text.slice(0, keepEnd).trim();
    }
  }

  // Final normalize spaces
  text = text.replace(/[ \t]{2,}/g, " ").trim();
  return text;
}

