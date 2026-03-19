import fs from "fs/promises";
import path from "path";

const {
  LOG_FILE = "./output/post-log.jsonl",
  LOG_DATE,
  LOG_LISTING_ID,
  LOG_LIMIT = "50",
} = process.env;

function parseDate(value) {
  if (!value) return "";
  return String(value).trim();
}

async function main() {
  const logPath = path.resolve(LOG_FILE);
  const raw = await fs.readFile(logPath, "utf8");
  const blocks = raw
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const dateFilter = parseDate(LOG_DATE);
  const idFilter = LOG_LISTING_ID ? String(LOG_LISTING_ID).trim() : "";
  const limit = Math.max(1, Number(LOG_LIMIT) || 50);

  let entries = blocks
    .map((block) => {
      try {
        return JSON.parse(block);
      } catch {
        // Fallback for old JSONL lines within the block
        const line = block.split(/\r?\n/)[0];
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }
    })
    .filter(Boolean);

  if (dateFilter) {
    entries = entries.filter((e) => e.ts && String(e.ts).startsWith(dateFilter));
  }

  if (idFilter) {
    entries = entries.filter((e) => String(e.listingId || "") === idFilter);
  }

  entries.slice(-limit).forEach((e) => {
    const summary = [
      e.ts,
      e.level,
      e.listingId ? `id=${e.listingId}` : "",
      e.listingTitle ? `title=${e.listingTitle}` : "",
      e.message,
    ]
      .filter(Boolean)
      .join(" | ");
    console.log(summary);
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
