import {
  readStoredToken,
  refreshLongLivedToken,
} from "./instagram-token.js";

const stored = await readStoredToken();
if (!stored?.accessToken) {
  console.log(
    "No managed long-lived token found; using IG_ACCESS_TOKEN from the environment."
  );
  process.exit(0);
}

const refreshBeforeMs =
  Math.max(1, Number(process.env.IG_TOKEN_REFRESH_DAYS || "7")) *
  24 *
  60 *
  60 *
  1000;
const expiresAt = Date.parse(stored.expiresAt || "");
if (Number.isFinite(expiresAt) && expiresAt - Date.now() > refreshBeforeMs) {
  console.log(`Instagram token is valid until ${stored.expiresAt}.`);
  process.exit(0);
}

const token = await refreshLongLivedToken();
console.log(`Instagram token refreshed; expires at ${token.expiresAt}.`);
