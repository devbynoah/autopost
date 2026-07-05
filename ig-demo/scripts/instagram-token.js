import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import { config } from "./runtime-config.js";

const tokenStorePath = path.resolve(
  config.IG_TOKEN_STORE_FILE || "./output/instagram-token.json"
);

async function requestToken(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Instagram token request failed: ${
        body?.error?.message || `HTTP ${response.status}`
      }`
    );
  }
  return body;
}

async function saveToken(body) {
  const expiresIn = Number(body.expires_in || 60 * 24 * 60 * 60);
  const payload = {
    accessToken: body.access_token,
    tokenType: body.token_type || "bearer",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
  await fs.mkdir(path.dirname(tokenStorePath), { recursive: true });
  const tempPath = `${tokenStorePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, tokenStorePath);
  return payload;
}

export async function exchangeForLongLivedToken() {
  if (!config.IG_ACCESS_TOKEN) {
    throw new Error("IG_ACCESS_TOKEN is required.");
  }
  if (!config.IG_APP_SECRET) {
    throw new Error("IG_APP_SECRET is required to exchange the token.");
  }
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: config.IG_APP_SECRET,
    access_token: config.IG_ACCESS_TOKEN,
  });
  const body = await requestToken(
    `https://graph.instagram.com/access_token?${params}`
  );
  return saveToken(body);
}

export async function refreshLongLivedToken() {
  if (!config.IG_ACCESS_TOKEN) {
    throw new Error("No Instagram token is available to refresh.");
  }
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: config.IG_ACCESS_TOKEN,
  });
  const body = await requestToken(
    `https://graph.instagram.com/refresh_access_token?${params}`
  );
  return saveToken(body);
}

export async function readStoredToken() {
  try {
    return JSON.parse(await fs.readFile(tokenStorePath, "utf8"));
  } catch {
    return null;
  }
}
