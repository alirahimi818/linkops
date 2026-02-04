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

function isListItemStart(line: string) {
  const s = line.trim();

  // Numbered: "1." "1)" "1 -" "10."
  if (/^\d{1,3}\s*(?:[.)]|-)\s+/.test(s)) return true;

  // Bullets: "- " "* " "• "
  if (/^(?:[-*•])\s+/.test(s)) return true;

  return false;
}

function stripListMarker(line: string) {
  return line
    .replace(/^\s*\d{1,3}\s*(?:[.)]|-)\s+/, "") // numbered
    .replace(/^\s*(?:[-*•])\s+/, "") // bullets
    .trim();
}

/**
 * Extract comments from pasted text.
 * If list items exist, only those are extracted (title/description/etc ignored).
 * Otherwise, treat as single comment.
 */
export function extractCommentsFromPastedText(raw: string) {
  const input = String(raw ?? "").replace(/\r\n?/g, "\n");
  const lines = input.split("\n");

  const hasList = lines.some((l) => isListItemStart(l));
  if (!hasList) {
    const single = cleanPastedCommentText(input);
    return single ? [single] : [];
  }

  const blocks: string[] = [];
  let cur: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (cur.length) cur.push("");
      continue;
    }

    if (isListItemStart(line)) {
      if (cur.length) {
        blocks.push(cur.join("\n"));
        cur = [];
      }
      cur.push(stripListMarker(line));
      continue;
    }

    if (cur.length) cur.push(line);
  }

  if (cur.length) blocks.push(cur.join("\n"));

  return blocks
    .map((b) => cleanPastedCommentText(b))
    .map((b) => b.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean);
}
