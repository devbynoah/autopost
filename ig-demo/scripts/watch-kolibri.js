import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

const {
  JSON_SOURCE_PATH = "./aanbod/kolibri-aanbod.json",
  WATCH_INTERVAL_SECONDS = "10",
  LAST_LISTING_STATE_FILE = "./output/last-listing.json",
  RETRY_COOLDOWN_SECONDS = "60",
  SKIP_INITIAL_POST = "1",
} = process.env;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function getLatestListingId(list) {
  if (!Array.isArray(list) || list.length === 0) return "";
  const last = list[list.length - 1];
  return last?.id ? String(last.id) : "";
}

async function readLastState(statePath) {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const json = JSON.parse(raw);
    return json?.lastId ? String(json.lastId) : "";
  } catch {
    return "";
  }
}

async function writeLastState(statePath, id) {
  const payload = { lastId: id, updatedAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
  const jsonPath = path.resolve(JSON_SOURCE_PATH);
  const statePath = path.resolve(LAST_LISTING_STATE_FILE);
  const intervalMs = Math.max(1000, Number(WATCH_INTERVAL_SECONDS) * 1000);

  console.log(`Watching ${jsonPath} every ${intervalMs / 1000}s...`);

  let isRunning = false;
  let lastAttemptId = "";
  let lastAttemptAt = 0;
  const cooldownMs = Math.max(1000, Number(RETRY_COOLDOWN_SECONDS) * 1000);
  let initialized = false;
  while (true) {
    try {
      const data = await readJson(jsonPath);
      const latestId = await getLatestListingId(data);
      const lastId = await readLastState(statePath);

      if (!initialized) {
        initialized = true;
        const shouldSkip =
          SKIP_INITIAL_POST !== "0" &&
          SKIP_INITIAL_POST.toLowerCase() !== "false";
        if (shouldSkip && latestId && latestId !== lastId) {
          await writeLastState(statePath, latestId);
          console.log(
            `Initial run: saved latest listing ${latestId} (no post).`
          );
          await sleep(intervalMs);
          continue;
        }
      }

      const now = Date.now();
      const recentlyAttempted =
        latestId &&
        latestId === lastAttemptId &&
        now - lastAttemptAt < cooldownMs;

      if (
        latestId &&
        latestId !== lastId &&
        !isRunning &&
        !recentlyAttempted
      ) {
        console.log(`New listing detected: ${latestId}. Running render-post...`);
        isRunning = true;
        lastAttemptId = latestId;
        lastAttemptAt = now;
        try {
          await run("npm", ["run", "render-post"], { cwd: process.cwd() });
          await writeLastState(statePath, latestId);
          console.log(`Completed render-post for ${latestId}.`);
        } finally {
          isRunning = false;
        }
      }
    } catch (err) {
      console.warn(err.message || err);
    }

    await sleep(intervalMs);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
