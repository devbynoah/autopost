import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config();

const tokenStorePath = path.resolve(
  process.env.IG_TOKEN_STORE_FILE || "./output/instagram-token.json"
);
try {
  const storedToken = JSON.parse(await fs.readFile(tokenStorePath, "utf8"));
  const expiresAt = Date.parse(storedToken.expiresAt || "");
  if (
    storedToken.accessToken &&
    (!Number.isFinite(expiresAt) || expiresAt > Date.now())
  ) {
    process.env.IG_ACCESS_TOKEN = storedToken.accessToken;
  }
} catch {}

const runtimePath = path.resolve(
  process.env.RUNTIME_CONFIG_FILE || "./output/runtime-config.json"
);

let runtime = {};
try {
  runtime = JSON.parse(await fs.readFile(runtimePath, "utf8"));
} catch {
  runtime = {};
}

for (const [key, value] of Object.entries(runtime)) {
  if (value !== null && value !== undefined) {
    process.env[key] = String(value);
  }
}

export const config = process.env;

export async function replaceRuntimeConfig(values) {
  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.writeFile(
    runtimePath,
    `${JSON.stringify(values, null, 2)}\n`,
    "utf8"
  );
}

export async function updateRuntimeConfig(values) {
  let current = {};
  try {
    current = JSON.parse(await fs.readFile(runtimePath, "utf8"));
  } catch {
    current = {};
  }
  await replaceRuntimeConfig({ ...current, ...values });
}
