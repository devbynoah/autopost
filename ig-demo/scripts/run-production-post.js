import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { config } from "./runtime-config.js";

const lockPath = path.resolve(
  config.POST_LOCK_FILE || "./output/posting.lock"
);
const staleAfterMs =
  Math.max(300, Number(config.POST_LOCK_STALE_SECONDS || "1800")) * 1000;

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

async function acquireLock() {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const stat = await fs.stat(lockPath);
    if (Date.now() - stat.mtimeMs > staleAfterMs) {
      await fs.unlink(lockPath);
    }
  } catch {}

  const handle = await fs.open(lockPath, "wx");
  await handle.writeFile(
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })
  );
  return handle;
}

let lockHandle;
try {
  lockHandle = await acquireLock();
} catch (err) {
  if (err.code === "EEXIST") {
    throw new Error("Another autopost job is already running.");
  }
  throw err;
}

try {
  const renderScripts = [
    "scripts/refresh-instagram-token.js",
    "scripts/validate-production-config.js",
    "scripts/apply-from-json.js",
    "scripts/render-image.js",
    "scripts/render-carousel-images.js",
  ];
  const publishScripts = [
    "scripts/upload-to-uploadcare.js",
    "scripts/upload-carousel-images.js",
    "scripts/post.js",
  ];
  const dryRun =
    process.argv.includes("--dry-run") ||
    config.DRY_RUN === "1" ||
    String(config.DRY_RUN).toLowerCase() === "true";
  const scripts = dryRun
    ? renderScripts
    : [...renderScripts, ...publishScripts];
  for (const script of scripts) await run(script);
  if (dryRun) console.log("Dry run complete; nothing was uploaded or posted.");
} finally {
  await lockHandle?.close().catch(() => {});
  await fs.unlink(lockPath).catch(() => {});
}
