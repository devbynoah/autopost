import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { config } from "./runtime-config.js";

const listingId = String(process.argv[2] || "").trim();
if (!listingId) {
  throw new Error("Usage: npm run post-listing -- <listing-id>");
}

const sourcePath = path.resolve(
  config.JSON_SOURCE_PATH || "./aanbod/kolibri-aanbod.json"
);
const listings = JSON.parse(
  (await fs.readFile(sourcePath, "utf8")).replace(/^\uFEFF/, "")
);
if (!listings.some((item) => String(item.id) === listingId)) {
  throw new Error(`Listing ${listingId} was not found in ${sourcePath}.`);
}

const child = spawn(process.execPath, ["scripts/run-production-post.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    LISTING_ID: listingId,
    LISTING_QUERY: "",
  },
  stdio: "inherit",
  shell: false,
});

child.on("error", (err) => {
  throw err;
});
child.on("close", (code) => {
  process.exitCode = code ?? 1;
});
