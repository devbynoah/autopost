import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

const {
  PAGES_BASE_URL,
  PAGES_RELATIVE_PATH = "ig-demo/output/ig-card.jpg",
  GIT_AUTO_PUSH,
  PAGES_WAIT_SECONDS = "20",
} = process.env;

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...options });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function toUrl(base, rel) {
  if (!base) return "";
  const trimmedBase = base.replace(/\/$/, "");
  const trimmedRel = rel.replace(/^\//, "");
  return `${trimmedBase}/${trimmedRel}`;
}

async function updateEnvImageUrl(url) {
  const envPath = path.resolve(".env");
  const content = await fs.readFile(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  let replaced = false;
  const next = lines.map((line) => {
    if (line.startsWith("IMAGE_URL=")) {
      replaced = true;
      return `IMAGE_URL=${url}`;
    }
    return line;
  });
  if (!replaced) {
    next.unshift(`IMAGE_URL=${url}`);
  }
  await fs.writeFile(envPath, next.join("\n"), "utf8");
}

async function main() {
  await run("node", ["scripts/apply-from-json.js"], { cwd: process.cwd() });
  await run("node", ["scripts/render-image.js"], { cwd: process.cwd() });

  const url = toUrl(PAGES_BASE_URL, PAGES_RELATIVE_PATH);
  if (!url) {
    console.log("PAGES_BASE_URL is not set. Skipping IMAGE_URL update.");
  } else {
    await updateEnvImageUrl(url);
    console.log(`IMAGE_URL set to: ${url}`);
  }

  if (GIT_AUTO_PUSH && GIT_AUTO_PUSH !== "0" && GIT_AUTO_PUSH !== "false") {
    try {
      await run("git", ["add", PAGES_RELATIVE_PATH], { cwd: process.cwd() });
      await run("git", ["commit", "-m", "Update ig-card"], {
        cwd: process.cwd(),
      });
    } catch (err) {
      console.log("Nothing to commit or git commit failed.");
    }

    try {
      await run("git", ["push"], { cwd: process.cwd() });
      const waitMs = Math.max(0, Number(PAGES_WAIT_SECONDS)) * 1000;
      if (waitMs) {
        console.log(`Waiting ${waitMs / 1000}s for Pages to update...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    } catch (err) {
      console.log("git push failed. Ensure you are authenticated.");
    }
  } else {
    console.log(
      "GIT_AUTO_PUSH is not enabled. Remember to commit + push the output file so GitHub Pages can serve it."
    );
  }

  await run("node", ["scripts/post.js"], { cwd: process.cwd() });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
